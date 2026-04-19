package com.los.decision.dto;

import com.los.decision.entity.DecisionStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonAlias;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManualDecisionDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    // Frontend uses 'decision' for final outcome. Status can be omitted by the
    // frontend.
    private DecisionStatus status;

    @NotBlank(message = "Final decision is required")
    @JsonAlias({ "decision" })
    private String finalDecision;

    private String remarks;

    // Accepts rejectionReasonCode from frontend as alias for backend
    // rejectionReason
    @JsonAlias({ "rejectionReasonCode" })
    private String rejectionReason;
}
