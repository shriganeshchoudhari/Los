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
@Schema(description = "DTO for PAN verification")
public class VerifyPanDto {

    @NotBlank(message = "Application ID is required")
    @Schema(description = "Application ID", example = "APP-2024-001")
    private String applicationId;

    @NotBlank(message = "PAN number is required")
    @Pattern(regexp = "^[A-Z]{5}[0-9]{4}[A-Z]$", message = "Invalid PAN format")
    @Schema(description = "10-character PAN number", example = "AAAPA5055K")
    private String panNumber;

    @NotBlank(message = "Full name is required")
    @Schema(description = "Full name as on PAN card", example = "John Doe")
    private String fullName;

    @NotBlank(message = "Date of birth is required")
    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$", message = "Date must be in YYYY-MM-DD format")
    @Schema(description = "Date of birth in YYYY-MM-DD format", example = "1990-01-15")
    private String dob;
}
