package com.los.kyc.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class KycRejectDto {

    private String applicationId;

    private String rejectionReason;

    private String rejectionCategory; // DOCUMENT_MISMATCH, FRAUD_DETECTED, etc.

    private Boolean allowResubmission;

    private Integer resubmissionAttempts;
}
