package com.los.loan.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerifyEsignDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotBlank(message = "Document URL is required")
    private String documentUrl;

    private String esignProvider;

    private String signatureData;
}
