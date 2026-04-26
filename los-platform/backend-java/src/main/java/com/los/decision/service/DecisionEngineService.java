package com.los.decision.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.los.decision.dto.*;
import com.los.decision.entity.*;
import com.los.decision.repository.*;
import com.los.integration.entity.BureauScore;
import com.los.loan.repository.LoanApplicationRepository;
import com.los.integration.repository.BureauScoreRepository;
import com.los.loan.entity.LoanStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class DecisionEngineService {

    private final DecisionRepository decisionRepository;
    private final DecisionRuleRepository decisionRuleRepository;
    private final DecisionHistoryRepository decisionHistoryRepository;
    private final LoanApplicationRepository loanApplicationRepository;
    private final BureauScoreRepository bureauScoreRepository;
    private final ObjectMapper objectMapper;

    // ── Trigger decision ──────────────────────────────────────────────────────

    public DecisionResponseDto triggerDecision(TriggerDecisionDto dto) {
        log.info("Triggering decision for application: {}", dto.getApplicationId());

        Optional<Decision> existing = decisionRepository.findByApplicationId(dto.getApplicationId());
        if (existing.isPresent() && !Boolean.TRUE.equals(dto.getForceRerun())) {
            log.info("Returning existing decision for application: {}", dto.getApplicationId());
            return mapToResponse(existing.get());
        }

        Decision decision = existing.orElseGet(Decision::new);
        decision.setId(decision.getId() != null ? decision.getId() : UUID.randomUUID().toString());
        decision.setApplicationId(dto.getApplicationId());
        decision.setStatus(DecisionStatus.IN_PROGRESS);
        decision.setDecisionType(DecisionType.RULE_ENGINE);
        decisionRepository.save(decision);

        // Build evaluation context from live data
        Map<String, Object> context = buildContext(dto.getApplicationId());
        log.debug("Decision context for {}: {}", dto.getApplicationId(), context);

        // Run all active rules using a dedicated helper method
        List<DecisionRule> rules = decisionRuleRepository.findAllActiveOrderByPriority();
        EvaluationOutcome outcome = evaluateRules(rules, context);
        List<String> failedRules = outcome.failedRuleCodes();
        List<String> rejectionReasons = outcome.rejectionReasons();
        boolean hardStop = outcome.hardStopEncountered();

        // Set final decision
        if (hardStop || !failedRules.isEmpty()) {
            decision.setStatus(DecisionStatus.REJECTED);
            decision.setFinalDecision("REJECTED");
            decision.setRejectionReason(String.join("; ", rejectionReasons));
        } else {
            decision.setStatus(DecisionStatus.APPROVED);
            decision.setFinalDecision("APPROVED");
            populateApprovalTerms(decision, context);
        }

        decision.setDecidedAt(LocalDateTime.now());
        decision.setDecidedBy("RULE_ENGINE_v1");

        Decision saved = decisionRepository.save(decision);

        // Synchronize with Loan Application status
        loanApplicationRepository.findById(dto.getApplicationId()).ifPresent(app -> {
            if (saved.getStatus() == DecisionStatus.APPROVED) {
                app.setStatus(LoanStatus.SANCTIONED);
                app.setApprovedAt(LocalDateTime.now());
                app.setSanctionAmount(saved.getApprovedAmount());
            } else if (saved.getStatus() == DecisionStatus.REJECTED) {
                app.setStatus(LoanStatus.REJECTED);
                app.setRejectedAt(LocalDateTime.now());
                app.setRejectionReason(saved.getRejectionReason());
            } else {
                app.setStatus(LoanStatus.UNDER_REVIEW);
            }
            loanApplicationRepository.save(app);
        });

        recordHistory(saved.getId(), dto.getApplicationId(), DecisionStatus.IN_PROGRESS,
                saved.getStatus(), "RULE_ENGINE", "Automated decision");

        log.info("Decision for application {}: {} (failed rules: {})",
                dto.getApplicationId(), saved.getFinalDecision(), failedRules);

        return mapToResponse(saved);
    }

    /**
     * Evaluate a list of {@link DecisionRule}s against the provided context.
     * Returns an {@link EvaluationOutcome} containing failed rule codes, reasons
     * and hard‑stop flag.
     */
    private EvaluationOutcome evaluateRules(List<DecisionRule> rules, Map<String, Object> context) {
        List<String> failed = new ArrayList<>();
        List<String> reasons = new ArrayList<>();
        boolean hardStop = false;

        for (DecisionRule rule : rules) {
            RuleResult result = evaluateRule(rule, context);
            if (!result.passed()) {
                failed.add(rule.getRuleCode());
                reasons.add(result.reason());
                if (result.hardStop()) {
                    hardStop = true;
                    log.info("Hard-stop rule failed — {}: {}", rule.getRuleCode(), result.reason());
                    break;
                }
            } else {
                log.debug("Rule passed: {}", rule.getRuleCode());
            }
        }
        return new EvaluationOutcome(failed, reasons, hardStop);
    }

    // ── Context builder ───────────────────────────────────────────────────────

    private Map<String, Object> buildContext(String applicationId) {
        Map<String, Object> ctx = new HashMap<>();

        // Loan application data
        loanApplicationRepository.findById(applicationId).ifPresent(app -> {
            ctx.put("requestedAmount", safeDouble(app.getRequestedAmount()));
            ctx.put("tenureMonths", app.getTenureMonths() != null ? app.getTenureMonths() : 0);
            ctx.put("annualIncome", safeDouble(app.getAnnualIncome()));
            ctx.put("monthlyIncome", safeDouble(app.getAnnualIncome()) / 12.0);
            ctx.put("loanType", app.getLoanType() != null ? app.getLoanType() : "PERSONAL_LOAN");
            ctx.put("employmentType", app.getEmploymentType() != null ? app.getEmploymentType() : "SALARIED");
            ctx.put("applicationStatus",
                    app.getStatus() != null ? app.getStatus().name() : LoanStatus.SUBMITTED.name());
        });

        // Bureau data — use best (highest) credit score from completed pulls
        List<BureauScore> scores = bureauScoreRepository.findByApplicationId(applicationId);
        if (!scores.isEmpty()) {
            int bestScore = scores.stream()
                    .filter(s -> s.getCreditScore() != null && s.getCreditScore() > 0)
                    .mapToInt(BureauScore::getCreditScore)
                    .max()
                    .orElse(0);
            ctx.put("creditScore", bestScore);

            // Parse best raw response for DPD, EMIs etc.
            scores.stream()
                    .filter(s -> s.getParsedResponse() != null && !s.getParsedResponse().isBlank())
                    .findFirst()
                    .ifPresent(s -> parseBureauContextFields(s.getParsedResponse(), ctx));
        } else {
            ctx.put("creditScore", 0);
        }

        // Derived: FOIR
        double monthlyIncome = (double) ctx.getOrDefault("monthlyIncome", 0.0);
        double existingEmi = (double) ctx.getOrDefault("totalMonthlyEmi", 0.0);
        double requestedAmount = (double) ctx.getOrDefault("requestedAmount", 0.0);
        int tenureMonths = (int) ctx.getOrDefault("tenureMonths", 0);
        double proposedEmi = tenureMonths > 0 && requestedAmount > 0
                ? calculateEmi(requestedAmount, tenureMonths, 1100)
                : 0;
        ctx.put("proposedEmi", proposedEmi);
        double foir = monthlyIncome > 0 ? ((existingEmi + proposedEmi) / monthlyIncome) * 100 : 100;
        ctx.put("foir", foir);

        return ctx;
    }

    private void parseBureauContextFields(String parsedJson, Map<String, Object> ctx) {
        try {
            JsonNode node = objectMapper.readTree(parsedJson);
            ctx.put("totalMonthlyEmi", node.path("totalMonthlyEmi").asDouble(0));
            ctx.put("activeAccounts", node.path("activeAccounts").asInt(0));
            ctx.put("writeOff", node.path("writeOff").asBoolean(false));
            ctx.put("suitFiled", node.path("suitFiled").asBoolean(false));
            JsonNode dpd = node.path("dpdBucket");
            if (!dpd.isMissingNode()) {
                ctx.put("dpd90Plus", dpd.path("dpd90Plus").asInt(0));
                ctx.put("dpd30To90", dpd.path("dpd30To90").asInt(0));
            }
            JsonNode enq = node.path("enquiries");
            if (!enq.isMissingNode()) {
                ctx.put("enquiriesLast30Days", enq.path("last30Days").asInt(0));
                ctx.put("enquiriesLast12Months", enq.path("last12Months").asInt(0));
            }
        } catch (Exception e) {
            log.warn("Failed to parse bureau context fields: {}", e.getMessage());
        }
    }

    // ── Rule evaluator ────────────────────────────────────────────────────────

    private RuleResult evaluateRule(DecisionRule rule, Map<String, Object> context) {
        try {
            JsonNode root = objectMapper.readTree(rule.getRuleDefinition());
            if (!root.isArray())
                return new RuleResult(true, false, "");

            for (JsonNode condition : root) {
                String rawField = condition.path("field").asText("");
                String operator = condition.path("operator").asText(">=");
                double threshold = condition.path("value").asDouble(0); // V010 uses 'value', not 'threshold'

                // Map legacy field names to context keys
                String field = mapField(rawField);

                Object rawValue = context.get(field);
                if (rawValue == null) {
                    // Fail if it's a hard-stop category or explicit mandatory flag
                    if (rule.getRuleCode().startsWith("CR") || rule.getRuleCode().startsWith("FO")) {
                        return new RuleResult(false, true,
                                "Field '" + field + "' not available for " + rule.getRuleName());
                    }
                    continue;
                }

                double value = toDouble(rawValue);
                boolean passed = evaluate(value, operator, threshold);

                if (!passed) {
                    String reason = String.format("%s failed: actual %.1f, required %s %.1f",
                            rule.getRuleName(), value, operator, threshold);
                    return new RuleResult(false, true, reason);
                }
            }
            return new RuleResult(true, false, "");

        } catch (Exception e) {
            log.warn("Rule evaluation error for {}: {}", rule.getRuleCode(), e.getMessage());
            return new RuleResult(true, false, "");
        }
    }

    private String mapField(String rawField) {
        return switch (rawField) {
            case "bureau_score.cibil" -> "creditScore";
            case "applicant.net_monthly_income" -> "monthlyIncome";
            case "applicant.annual_income" -> "annualIncome";
            case "calculated_foir" -> "foir";
            case "loan.requested_amount" -> "requestedAmount";
            case "applicant.age" -> "age";
            default -> rawField;
        };
    }

    private boolean evaluate(double value, String operator, double threshold) {
        return switch (operator) {
            case ">=" -> value >= threshold;
            case ">" -> value > threshold;
            case "<=" -> value <= threshold;
            case "<" -> value < threshold;
            case "==" -> Math.abs(value - threshold) < 0.001;
            case "!=" -> Math.abs(value - threshold) >= 0.001;
            case "eq" -> Math.abs(value - threshold) < 0.001;
            case "neq" -> Math.abs(value - threshold) >= 0.001;
            default -> {
                log.warn("Unknown operator: {}", operator);
                yield true;
            }
        };
    }

    private void populateApprovalTerms(Decision decision, Map<String, Object> context) {
        double requestedAmount = (double) context.getOrDefault("requestedAmount", 0.0);
        int tenureMonths = (int) context.getOrDefault("tenureMonths", 12);
        int creditScore = (int) context.getOrDefault("creditScore", 700);

        // Spread based on credit score
        int spreadBps = creditScore >= 750 ? 200 : creditScore >= 700 ? 300 : creditScore >= 650 ? 400 : 500;
        int mclrBps = 875; // 8.75% MCLR base
        int totalRateBps = mclrBps + spreadBps;

        decision.setApprovedAmount(BigDecimal.valueOf(requestedAmount));
        decision.setApprovedTenureMonths(tenureMonths);
        decision.setInterestRateBps(totalRateBps);
        decision.setSpreadBps(spreadBps);
        // benchmarkRate is a String in the Decision entity; convert numeric value to
        // string
        decision.setBenchmarkRate(String.valueOf((double) mclrBps / 100));
        // processingFeePaisa expects a long; calculate 1% of the requested amount in
        // paisa
        decision.setProcessingFeePaisa((long) (requestedAmount * 100)); // 1% in paisa
        decision.setFoirActual(BigDecimal.valueOf((double) context.getOrDefault("foir", 0.0)));
    }

    // ── Other operations ──────────────────────────────────────────────────────

    public DecisionResponseDto getDecision(String applicationId) {
        Decision decision = decisionRepository.findByApplicationId(applicationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Decision not found for application: " + applicationId));
        return mapToResponse(decision);
    }

    public DecisionResponseDto manualOverride(ManualDecisionDto dto, String userId) {
        Decision decision = decisionRepository.findByApplicationId(dto.getApplicationId())
                .orElseThrow(() -> new IllegalArgumentException("Decision not found"));

        DecisionStatus previousStatus = decision.getStatus();
        decision.setStatus(dto.getStatus());
        decision.setFinalDecision(dto.getDecision());
        decision.setRejectionReason(dto.getRejectionReasonCode());
        decision.setRemarks(dto.getRemarks());
        decision.setDecidedBy(userId);
        decision.setDecidedAt(LocalDateTime.now());

        Decision updated = decisionRepository.save(decision);

        // Synchronize with Loan Application status
        loanApplicationRepository.findById(dto.getApplicationId()).ifPresent(app -> {
            if (updated.getStatus() == DecisionStatus.APPROVED) {
                app.setStatus(LoanStatus.SANCTIONED);
                app.setApprovedAt(LocalDateTime.now());
                app.setSanctionAmount(updated.getApprovedAmount());
            } else if (updated.getStatus() == DecisionStatus.REJECTED) {
                app.setStatus(LoanStatus.REJECTED);
                app.setRejectedAt(LocalDateTime.now());
                app.setRejectionReason(updated.getRejectionReason());
            }
            loanApplicationRepository.save(app);
        });

        recordHistory(decision.getId(), dto.getApplicationId(), previousStatus, dto.getStatus(), userId,
                "Manual override");
        return mapToResponse(updated);
    }

    public DecisionResponseDto requestOverride(OverrideRequestDto dto, String userId) {
        Decision decision = decisionRepository.findByApplicationId(dto.getApplicationId())
                .orElseThrow(() -> new IllegalArgumentException("Decision not found"));

        DecisionStatus prev = decision.getStatus();
        decision.setStatus(DecisionStatus.OVERRIDE_PENDING);
        decision.setRemarks(dto.getJustification());
        Decision updated = decisionRepository.save(decision);
        recordHistory(decision.getId(), dto.getApplicationId(), prev, DecisionStatus.OVERRIDE_PENDING,
                userId, "Override requested: " + dto.getJustification());
        return mapToResponse(updated);
    }

    public List<RuleListDto> listRules() {
        return decisionRuleRepository.findAllActiveOrderByPriority()
                .stream().map(this::mapRuleToDto).collect(Collectors.toList());
    }

    public List<DecisionResponseDto> getDecisionsByStatus(String status) {
        return decisionRepository.findByStatus(DecisionStatus.valueOf(status.toUpperCase()))
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public List<DecisionHistory> getDecisionHistory(String applicationId) {
        return decisionHistoryRepository.findByApplicationIdOrderByCreatedAtDesc(applicationId);
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    private void recordHistory(String decisionId, String applicationId,
            DecisionStatus before, DecisionStatus after,
            String changedBy, String reason) {
        DecisionHistory history = new DecisionHistory();
        history.setId(UUID.randomUUID().toString());
        history.setDecisionId(decisionId);
        history.setApplicationId(applicationId);
        history.setStatusBefore(before);
        history.setStatusAfter(after);
        history.setChangedBy(changedBy);
        history.setChangeReason(reason);
        decisionHistoryRepository.save(history);
    }

    /** Flat-rate EMI: P * r * (1+r)^n / ((1+r)^n - 1) */
    private double calculateEmi(double principal, int tenureMonths, int rateBps) {
        double r = rateBps / 10000.0 / 12;
        double factor = Math.pow(1 + r, tenureMonths);
        return principal * r * factor / (factor - 1);
    }

    private double safeDouble(BigDecimal v) {
        return v != null ? v.doubleValue() : 0.0;
    }

    private double toDouble(Object v) {
        if (v instanceof Number n)
            return n.doubleValue();
        if (v instanceof Boolean b)
            return b ? 1.0 : 0.0;
        try {
            return Double.parseDouble(v.toString());
        } catch (Exception e) {
            return 0.0;
        }
    }

    private DecisionResponseDto mapToResponse(Decision d) {
        DecisionResponseDto dto = new DecisionResponseDto();
        dto.setId(d.getId());
        dto.setApplicationId(d.getApplicationId());
        dto.setStatus(d.getStatus());
        dto.setDecisionType(d.getDecisionType());
        dto.setDecision(d.getFinalDecision());
        dto.setApprovedAmount(d.getApprovedAmount());
        dto.setApprovedTenureMonths(d.getApprovedTenureMonths());
        dto.setInterestRateBps(d.getInterestRateBps());
        dto.setSpreadBps(d.getSpreadBps());
        dto.setBenchmarkRate(d.getBenchmarkRate());
        dto.setProcessingFeePaisa(d.getProcessingFeePaisa());
        dto.setInsuranceMandatory(d.getInsuranceMandatory());
        dto.setLtvRatio(d.getLtvRatio());
        dto.setFoirActual(d.getFoirActual());
        dto.setScorecardResult(d.getScorecardResult());
        dto.setConditions(d.getConditions());
        dto.setRejectionReason(d.getRejectionReason());
        dto.setDecidedAt(d.getDecidedAt());
        dto.setDecidedBy(d.getDecidedBy());
        dto.setRemarks(d.getRemarks());
        return dto;
    }

    private RuleListDto mapRuleToDto(DecisionRule r) {
        RuleListDto dto = new RuleListDto();
        dto.setId(r.getId());
        dto.setRuleCode(r.getRuleCode());
        dto.setRuleName(r.getRuleName());
        dto.setPriority(r.getPriority());
        dto.setIsActive(r.getIsActive());
        dto.setProductType(r.getProductType());
        dto.setVersion(r.getRuleVersion());
        dto.setDescription(r.getDescription());
        return dto;
    }

    /** Immutable result record for a single rule evaluation. */
    private record RuleResult(boolean passed, boolean hardStop, String reason) {
    }
}
