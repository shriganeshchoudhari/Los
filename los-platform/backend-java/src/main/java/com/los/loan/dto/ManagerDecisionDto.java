package com.los.loan.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManagerDecisionDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotBlank(message = "Decision is required")
    private String decision; // APPROVE, REJECT, REQUEST_MORE_INFO

    private String remarks;

    private java.math.BigDecimal approvalAmount;

    private Integer approvalTenureMonths;

    private Integer interestRateBps;

    private String decisionReason;
}
