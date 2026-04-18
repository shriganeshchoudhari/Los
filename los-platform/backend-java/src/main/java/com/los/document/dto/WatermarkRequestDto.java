package com.los.document.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WatermarkRequestDto {

    @NotBlank(message = "Document ID is required")
    private String documentId;

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    private String watermarkText;

    private String watermarkColor = "GRAY";

    private String watermarkPosition = "CENTER";

    private Integer opacity = 50;
}
