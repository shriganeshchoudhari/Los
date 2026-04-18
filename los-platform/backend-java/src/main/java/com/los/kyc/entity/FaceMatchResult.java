package com.los.kyc.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "face_match_results", schema = "kyc")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FaceMatchResult extends BaseEntity {

    @Column(name = "kyc_id", nullable = false, length = 36)
    private String kycId;

    @Column(name = "selfie_storage_key", nullable = false, length = 500)
    private String selfieStorageKey;

    @Column(name = "selfie_encryption_key_ref", length = 100)
    private String selfieEncryptionKeyRef;

    @Column(name = "aadhaar_photo_storage_key", nullable = false, length = 500)
    private String aadhaarPhotoStorageKey;

    @Column(name = "match_score", nullable = false, columnDefinition = "smallint")
    private Integer matchScore;

    @Column(name = "liveness_score", nullable = false, columnDefinition = "smallint")
    private Integer livenessScore;

    @Column(name = "face_match_status", nullable = false, length = 20)
    private String faceMatchStatus;

    @Column(name = "confidence_level", columnDefinition = "smallint")
    private Integer confidenceLevel;

    @Column(name = "provider", length = 50)
    private String provider;

    @Column(name = "processed_at", columnDefinition = "timestamptz")
    private Instant processedAt;
}
