# ADR-016: Credit Decision Engine (Rules + ML)

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform must make credit decisions (approve/reject/conditional) for loan applications. Decision inputs include: bureau scores (CIBIL, Experian, Equifax, CRIF), KYC verification results, financial ratios (FOIR, LTV), product-specific rules, and — for complex cases — ML model scores. The decision must be explainable (RBI requires rejection reasons), auditable, and overridable by authorized personnel.

---

## Decision

The `decision-engine` service uses a **hybrid approach**: rules engine for deterministic decisions + ML model scores as input factors.

### Decision inputs

| Input | Source | Weight/Rule |
|-------|--------|-------------|
| Bureau score | integration-service (aggregated) | Primary factor |
| Bureau DPD | integration-service (max DPD over 90 days) | Hard rule: > 90 days DPD → auto-reject |
| FOIR (Fixed Obligations to Income Ratio) | loan-service EMI calculator | ≤ 50% for salaried, ≤ 40% for self-employed |
| LTV (Loan to Value) | loan-service | ≤ 80% for LAP, ≤ 85% for VL, 100% for PL |
| Product eligibility | loan_product_configs | min/max amount, tenure, income threshold |
| KYC completeness | kyc-service | All KYC items VERIFIED required |
| ML score | decision-engine (internal model) | Combined with bureau score |
| Manual score | CREDIT_ANALYST input | Override input |

### Decision output

```typescript
interface DecisionResult {
  applicationId: string;
  decision: 'APPROVED' | 'REJECTED' | 'CONDITIONAL' | 'PENDING';
  approvedAmount?: number;      // may be less than requested
  rateOfInterestBps?: number;    // in basis points (e.g., 950 = 9.50%)
  approvedTenureMonths?: number; // may be less than requested
  scorecardGrade?: string;       // A/B/C/D/E
  rulesPassed: string[];         // for explainability
  rulesFailed: string[];         // for rejection reasons
  mlModelScore?: number;        // 0-1 probability of default
  bureauScore?: number;          // primary bureau score used
  overrideRequested?: boolean;    // if conditional and manager requested
}
```

### Rules engine

`rules.service.ts` evaluates rule sets per loan product:
- **Bureau rules**: score threshold, DPD threshold, write-off check, suit-filed check
- **Income rules**: minimum income, FOIR calculation, employment stability
- **Product rules**: amount limits, tenure limits, age limits
- **Compliance rules**: RBI guidelines (e.g., no loans to politically exposed persons without extra review)

### ML model

`ml.service.ts` provides:
- **Scorecard model**: logistic regression on bureau features → probability of default
- **Grade assignment**: maps probability to grade (A/B/C/D/E) with different rate bands
- **Explainability**: SHAP values for top features contributing to score

### Override workflow

See ADR-015: Maker-Checker for Financial Operations.

---

## Consequences

### Positive
- **Explainability**: `rulesPassed` / `rulesFailed` arrays provide clear rejection reasons
- **Auditability**: every decision logged with all input factors
- **Hybrid approach**: deterministic rules for compliance, ML for risk assessment
- **Override workflow**: authorized personnel can override with documented justification
- **Product flexibility**: different loan types have different rule sets

### Negative
- **Model drift**: ML model degrades over time; needs periodic retraining
- **Bureau dependency**: no decision possible if all bureaus are unavailable
- **Complexity**: rules × products × segments creates large decision matrix
- **Latency**: bureau pulls are the longest step (can be 5-15 seconds)

### Mitigations
- Circuit breaker pattern: if bureau is down, decision uses last cached score
- A/B testing: new rules can be rolled out to a % of traffic
- Decision audit dashboard: compliance team reviews all REJECTED and CONDITIONAL decisions
- ML model monitored for prediction drift via Prometheus metrics

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-003: Kafka as Event Bus
- ADR-015: Maker-Checker for Financial Operations
