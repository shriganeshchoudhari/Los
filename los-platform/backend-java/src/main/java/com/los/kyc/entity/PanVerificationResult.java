package com.los.kyc.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "pan_verification_results", schema = "kyc")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PanVerificationResult extends BaseEntity {

    @Column(name = "kyc_id", nullable = false, length = 36)
    private String kycId;

    @Column(name = "pan_number_masked", nullable = false, length = 10)
    private String panNumberMasked;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "pan_number_encrypted", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> panNumberEncrypted;

    @Column(name = "name_match_score", nullable = false, columnDefinition = "smallint")
    private Integer nameMatchScore;

    @Column(name = "name_on_pan", nullable = false, length = 200)
    private String nameOnPan;

    @Column(name = "dob_match", nullable = false)
    @Builder.Default
    private Boolean dobMatch = false;

    @Column(name = "pan_status", nullable = false, length = 10)
    private String panStatus;

    @Column(name = "linked_aadhaar", nullable = false)
    @Builder.Default
    private Boolean linkedAadhaar = false;

    @Column(name = "aadhaar_seeding_status", length = 15)
    private String aadhaarSeedingStatus;

    @Column(name = "nsdl_transaction_id", length = 100)
    private String nsdlTransactionId;

    @Column(name = "verified_at", columnDefinition = "timestamptz")
    private Instant verifiedAt;
}
