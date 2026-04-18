package com.los.kyc.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.EqualsAndHashCode;

@EqualsAndHashCode(callSuper = false)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "kyc_risk_assessments", schema = "kyc", indexes = {
    @Index(name = "idx_kyc_risk_kyc_record_id", columnList = "kyc_record_id")
})
public class KycRiskAssessment extends BaseEntity {

    @Column(name = "kyc_record_id", nullable = false)
    private String kycRecordId;

    @Column(name = "risk_level", length = 50)
    private String riskLevel; // LOW, MEDIUM, HIGH, CRITICAL

    @Column(name = "risk_score", precision = 5, scale = 2)
    private java.math.BigDecimal riskScore;

    @Column(name = "risk_category", length = 100)
    private String riskCategory;

    @Column(name = "risk_factors", columnDefinition = "jsonb")
    private String riskFactors; // JSON array of risk factors

    @Column(name = "assessment_date")
    private java.time.LocalDateTime assessmentDate;

    @Column(name = "assessed_by")
    private String assessedBy;

    @Column(name = "assessment_notes", columnDefinition = "text")
    private String assessmentNotes;

    @Column(name = "mitigation_measures", columnDefinition = "jsonb")
    private String mitigationMeasures; // JSON array of mitigation measures
}
