package com.los.integration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PullBureauDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotBlank(message = "Applicant ID is required")
    private String applicantId;

    @NotBlank(message = "PAN is required")
    private String pan;

    @NotNull(message = "Provider is required")
    private String provider;

    private String consentId;

    private String consentTimestamp;
}
