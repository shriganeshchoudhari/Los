package com.los.decision.dto;

import com.los.decision.entity.DecisionStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManualDecisionDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @jakarta.validation.constraints.NotNull(message = "Decision status is required")
    private DecisionStatus status;

    @NotBlank(message = "Final decision value is required")
    private String decision; // Renamed from finalDecision to align with entity and OpenAPI surface

    private String remarks;

    // Primary field for rejection reasons as per contract
    private String rejectionReasonCode;

    private java.math.BigDecimal approvedAmount;
    private Integer approvedTenureMonths;
}
