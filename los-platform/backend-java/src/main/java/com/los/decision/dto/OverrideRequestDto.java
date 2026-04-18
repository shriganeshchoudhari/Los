package com.los.decision.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OverrideRequestDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotBlank(message = "Requested decision is required")
    private String requestedDecision;

    private String justification;

    private String comments;
}
