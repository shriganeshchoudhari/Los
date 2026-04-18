package com.los.document.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentStatusDto {

    private String documentId;

    private String documentName;

    private String status;

    private String documentType;

    private String uploadedAt;

    private String verifiedAt;

    private String verifiedBy;

    private String verificationRemarks;

    private Long fileSize;

    private String mimeType;
}
