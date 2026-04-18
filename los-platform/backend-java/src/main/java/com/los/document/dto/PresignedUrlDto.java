package com.los.document.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PresignedUrlDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotBlank(message = "Document name is required")
    private String documentName;

    @NotBlank(message = "Document type is required")
    private String documentType;

    @NotBlank(message = "Content type is required")
    private String contentType;

    private Long fileSize;

    private String expiryMinutes = "30";
}
