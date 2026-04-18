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
@Schema(description = "DTO for face match request")
public class FaceMatchDto {

    @NotBlank(message = "Application ID is required")
    @Schema(description = "Application ID", example = "APP-2024-001")
    private String applicationId;

    @NotBlank(message = "Selfie image is required")
    @Schema(description = "Base64 encoded selfie image")
    private String selfieImageBase64;
}
