package com.los.kyc.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class KycRiskAssessmentDto {

    private String applicationId;

    private String riskLevel;

    private java.math.BigDecimal riskScore;

    private String riskCategory;

    private java.util.List<String> riskFactors;

    private String assessmentNotes;
}
