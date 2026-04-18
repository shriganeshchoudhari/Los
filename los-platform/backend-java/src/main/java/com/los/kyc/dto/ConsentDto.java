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
@Schema(description = "DTO for capturing consent")
public class ConsentDto {

    @NotBlank(message = "Application ID is required")
    @Schema(description = "Application ID", example = "APP-2024-001")
    private String applicationId;

    @NotBlank(message = "Consent type is required")
    @Schema(description = "Type of consent", example = "KYC_VERIFICATION")
    private String consentType;

    @NotBlank(message = "Consent text is required")
    @Schema(description = "Full consent text")
    private String consentText;
}
