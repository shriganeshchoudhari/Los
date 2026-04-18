package com.los.document.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OcrResponseDto {

    private String documentId;

    private String ocrStatus;

    private String extractedText;

    private Double confidence;

    private String ocrProvider;

    private Long processingTimeMs;

    private String dataJson;

    private String errorMessage;
}
