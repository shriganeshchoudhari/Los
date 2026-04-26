package com.los.integration.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.los.integration.dto.*;
import com.los.integration.entity.*;
import com.los.integration.repository.*;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class BureauIntegrationService {

    private final BureauScoreRepository bureauScoreRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${los.integration.cibil-url:http://localhost:8080/bureau/cibil/report}")
    private String cibilUrl;

    @Value("${los.integration.experian-url:http://localhost:8080/bureau/experian/report}")
    private String experianUrl;

    @Value("${los.integration.equifax-url:http://localhost:8080/bureau/equifax/report}")
    private String equifaxUrl;

    @Value("${los.integration.crif-url:http://localhost:8080/bureau/crif/report}")
    private String crifUrl;

    /**
     * Pull bureau score from the specified provider.
     * Routes to WireMock in dev, real API in prod.
     * Uses circuit breaker to handle provider outages.
     */
    @CircuitBreaker(name = "cibil", fallbackMethod = "pullBureauDataFallback")
    public BureauScore pullBureauData(PullBureauDto dto) {
        log.info("Pulling bureau data — application: {}, provider: {}", dto.getApplicationId(), dto.getProvider());

        // Idempotency: return existing if already pulled within 30 days
        Optional<BureauScore> existing = bureauScoreRepository.findByApplicationIdAndProvider(
                dto.getApplicationId(), BureauProvider.valueOf(dto.getProvider()));

        if (existing.isPresent() && existing.get().getPullTimestamp() != null &&
            existing.get().getPullTimestamp().isAfter(LocalDateTime.now().minusDays(30))) {
            log.info("Bureau data already pulled within 30 days for application: {}", dto.getApplicationId());
            return existing.get();
        }

        // Create the DB record (status IN_PROGRESS)
        BureauScore score = existing.orElseGet(() -> {
            BureauScore s = new BureauScore();
            s.setId(UUID.randomUUID().toString());
            return s;
        });
        score.setApplicationId(dto.getApplicationId());
        score.setApplicantId(dto.getApplicantId() != null ? dto.getApplicantId() : dto.getApplicationId());
        score.setProvider(BureauProvider.valueOf(dto.getProvider()));
        score.setStatus(BureauPullStatus.IN_PROGRESS);
        score.setPanHash(dto.getPan());
        score.setConsentTimestamp(LocalDateTime.now());
        score.setRetryCount(0);
        bureauScoreRepository.save(score);

        // Call bureau endpoint
        String bureauUrl = resolveUrl(dto.getProvider());
        Map<String, Object> request = new HashMap<>();
        request.put("name", dto.getName() != null ? dto.getName() : "");
        request.put("pan", dto.getPan() != null ? dto.getPan() : "");
        request.put("dob", dto.getDob() != null ? dto.getDob() : "");
        request.put("mobile", dto.getMobile() != null ? dto.getMobile() : "");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<String> response = restTemplate.exchange(
                bureauUrl, HttpMethod.POST,
                new HttpEntity<>(request, headers), String.class);

        // Parse response
        try {
            JsonNode body = objectMapper.readTree(response.getBody());
            score.setCreditScore(body.path("score").asInt(0));
            score.setReportId(body.path("reportId").asText());
            score.setRawResponse(response.getBody());
            score.setParsedResponse(buildParsedSummary(body));
            score.setStatus(BureauPullStatus.SUCCESS);
            score.setPullTimestamp(LocalDateTime.now());
            log.info("Bureau pull complete — application: {}, provider: {}, score: {}",
                    dto.getApplicationId(), dto.getProvider(), score.getCreditScore());
        } catch (Exception e) {
            log.error("Failed to parse bureau response for {}: {}", dto.getProvider(), e.getMessage());
            score.setStatus(BureauPullStatus.FAILED);
            score.setErrorMessage("Parse error: " + e.getMessage());
        }

        return bureauScoreRepository.save(score);
    }

    @SuppressWarnings("unused")
    public BureauScore pullBureauDataFallback(PullBureauDto dto, Throwable t) {
        log.error("Bureau circuit open for provider {}: {}", dto.getProvider(), t.getMessage());

        // Return partial record with error status
        BureauScore score = new BureauScore();
        score.setId(UUID.randomUUID().toString());
        score.setApplicationId(dto.getApplicationId());
        score.setApplicantId(dto.getApplicationId());
        score.setProvider(BureauProvider.valueOf(dto.getProvider()));
        score.setStatus(BureauPullStatus.FAILED);
        score.setErrorMessage("Circuit breaker open: " + t.getMessage());
        score.setRetryCount(0);
        return bureauScoreRepository.save(score);
    }

    @Transactional(readOnly = true)
    public List<BureauScore> getBureauScores(String applicationId) {
        return bureauScoreRepository.findByApplicationId(applicationId);
    }

    public BureauScore updateBureauScore(String bureauScoreId, String creditScore, String status) {
        BureauScore score = bureauScoreRepository.findById(bureauScoreId)
                .orElseThrow(() -> new IllegalArgumentException("Bureau score not found: " + bureauScoreId));
        score.setStatus(BureauPullStatus.valueOf(status));
        if (creditScore != null) score.setCreditScore(Integer.parseInt(creditScore));
        return bureauScoreRepository.save(score);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String resolveUrl(String provider) {
        return switch (provider.toUpperCase()) {
            case "CIBIL"    -> cibilUrl;
            case "EXPERIAN" -> experianUrl;
            case "EQUIFAX"  -> equifaxUrl;
            case "CRIF"     -> crifUrl;
            default -> throw new IllegalArgumentException("Unknown bureau provider: " + provider);
        };
    }

    private String buildParsedSummary(JsonNode body) {
        try {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("score", body.path("score").asInt());
            summary.put("grade", body.path("grade").asText(""));
            summary.put("totalAccounts", body.path("totalAccounts").asInt(0));
            summary.put("activeAccounts", body.path("activeAccounts").asInt(0));
            summary.put("totalMonthlyEmi", body.path("totalMonthlyEmi").asDouble(0));
            summary.put("writeOff", body.path("writeOff").asBoolean(false));
            summary.put("suitFiled", body.path("suitFiled").asBoolean(false));
            if (body.has("dpdBucket")) summary.put("dpdBucket", body.get("dpdBucket"));
            if (body.has("enquiries")) summary.put("enquiries", body.get("enquiries"));
            return objectMapper.writeValueAsString(summary);
        } catch (Exception e) {
            return "{}";
        }
    }
}
