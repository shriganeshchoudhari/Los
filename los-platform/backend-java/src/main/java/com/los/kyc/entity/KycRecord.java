package com.los.kyc.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "kyc_records", schema = "kyc")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KycRecord extends BaseEntity {

    @Column(name = "application_id", nullable = false, unique = true, length = 36)
    private String applicationId;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(length = 30, nullable = false)
    @Builder.Default
    private KycStatus status = KycStatus.NOT_STARTED;

    @Column(name = "overall_risk_score", columnDefinition = "smallint")
    private Integer overallRiskScore;

    @Column(name = "reviewed_by", length = 36)
    private String reviewedBy;

    @Column(name = "review_notes", columnDefinition = "text")
    private String reviewNotes;

    public enum KycStatus {
        NOT_STARTED,
        AADHAAR_OTP_SENT,
        AADHAAR_VERIFIED,
        PAN_VERIFIED,
        FACE_MATCH_PENDING,
        FACE_MATCH_PASSED,
        FACE_MATCH_FAILED,
        KYC_COMPLETE,
        KYC_FAILED,
        MANUAL_REVIEW
    }
}
