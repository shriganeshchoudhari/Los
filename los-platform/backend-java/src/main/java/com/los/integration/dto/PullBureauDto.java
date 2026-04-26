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

    // Applicant ID, PAN and Provider are optional for the current UI flow
    private String applicantId;

    @NotBlank(message = "PAN is required")
    private String pan;

    @NotNull(message = "Provider is required")
    private String provider;

    private String consentId;

    private String consentTimestamp;
    
    private String name;
    private String dob;
    private String mobile;
}
