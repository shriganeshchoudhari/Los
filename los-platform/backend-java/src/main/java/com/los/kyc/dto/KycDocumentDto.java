package com.los.kyc.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class KycDocumentDto {

    private String documentId;

    private String documentType;

    private String documentNumber;

    private String status;

    private java.time.LocalDate expiryDate;

    private String documentUrl;
}
