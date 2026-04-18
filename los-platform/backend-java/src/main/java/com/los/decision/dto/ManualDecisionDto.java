package com.los.decision.dto;

import com.los.decision.entity.DecisionStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManualDecisionDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotNull(message = "Status is required")
    private DecisionStatus status;

    @NotBlank(message = "Final decision is required")
    private String finalDecision;

    private String remarks;

    private String rejectionReason;
}
