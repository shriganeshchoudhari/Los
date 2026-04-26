package com.los.kyc.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "DTO for verifying Aadhaar OTP")
public class VerifyAadhaarOtpDto {

    @NotBlank(message = "Application ID is required")
    @Schema(description = "Application ID", example = "APP-2024-001")
    private String applicationId;

    @NotBlank(message = "Transaction ID is required")
    @Schema(description = "Transaction ID from initiate response")
    private String txnId;

    // UIDAI reference ID is optional for now – frontend does not provide it
    @Schema(description = "UIDAI reference ID from initiate response", nullable = true)
    private String uidaiRefId;

    @NotBlank(message = "OTP is required")
    @Pattern(regexp = "^\\d{6}$", message = "OTP must be a 6-digit number")
    @Schema(description = "6-digit OTP from UIDAI", example = "123456")
    private String otp;

    @Schema(description = "Aadhaar Number (used for hashing)", example = "1234-5678-9012")
    private String aadhaarNumber;
}
