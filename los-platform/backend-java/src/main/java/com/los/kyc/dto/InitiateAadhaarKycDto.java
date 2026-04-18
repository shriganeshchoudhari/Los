package com.los.kyc.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "DTO for initiating Aadhaar eKYC")
public class InitiateAadhaarKycDto {

    @NotBlank(message = "Application ID is required")
    @Schema(description = "Application ID", example = "APP-2024-001")
    private String applicationId;

    @NotBlank(message = "Consent OTP session ID is required")
    @Schema(description = "OTP session ID for consent confirmation", example = "session-12345")
    private String consentOtpSessionId;
}
