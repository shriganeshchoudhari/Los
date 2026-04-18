package com.los.document.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OcrRequestDto {

    @NotBlank(message = "Document ID is required")
    private String documentId;

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    private Boolean extractData = true;

    private String language = "en";
}
