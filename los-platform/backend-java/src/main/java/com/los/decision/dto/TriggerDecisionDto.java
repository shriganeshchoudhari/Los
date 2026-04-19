package com.los.decision.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonAlias;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TriggerDecisionDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotNull(message = "Force rerun flag is required")
    private Boolean forceRerun = false;

    // Canonical field: contextData
    private String contextData;
}
