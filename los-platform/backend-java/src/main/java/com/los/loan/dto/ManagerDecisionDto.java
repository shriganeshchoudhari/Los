package com.los.loan.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManagerDecisionDto {

    // applicationId is injected by the controller from the path variable; not required in body
    private String applicationId;

    // Frontend sends 'action' (APPROVED / CONDITIONALLY_APPROVED / REJECTED)
    private String action;

    // Legacy alias — kept for backward compatibility
    private String decision;

    private String remarks;

    // Frontend fields
    private BigDecimal sanctionedAmount;
    private Integer rateOfInterestBps;
    private Integer tenureMonths;

    // Internal aliases used by older service code
    private BigDecimal approvalAmount;
    private Integer approvalTenureMonths;
    private Integer interestRateBps;

    private String decisionReason;

    /** Resolves the canonical action string regardless of which field the caller populated. */
    public String resolvedAction() {
        if (action != null && !action.isBlank()) return action.toUpperCase();
        if (decision != null && !decision.isBlank()) return decision.toUpperCase();
        return null;
    }
}

