package com.los.kyc.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class KycCompletionDto {

    private String applicationId;

    private Boolean aadhaarVerified;

    private Boolean panVerified;

    private Boolean faceMatched;

    private Boolean consentObtained;

    private Boolean allStepsCompleted;

    private Integer completionPercentage;

    private String nextStep;
}
