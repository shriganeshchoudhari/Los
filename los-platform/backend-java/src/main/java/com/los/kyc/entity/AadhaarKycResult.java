package com.los.kyc.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

@Entity
@Table(name = "aadhaar_kyc_results", schema = "kyc")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AadhaarKycResult extends BaseEntity {

    @Column(name = "kyc_id", nullable = false, length = 36)
    private String kycId;

    @Column(name = "txn_id", nullable = false, length = 100)
    private String txnId;

    @Column(name = "uidai_ref_id", nullable = false, length = 100)
    private String uidaiRefId;

    @Column(name = "aadhaar_number_hash", nullable = false, length = 64)
    private String aadhaarNumberHash;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false)
    private LocalDate dob;

    @Column(nullable = false, length = 1)
    private String gender;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "address_json", columnDefinition = "jsonb")
    private Map<String, Object> addressJson;

    @Column(name = "photo_storage_key", length = 500)
    private String photoStorageKey;

    @Column(name = "photo_encryption_key_ref", length = 100)
    private String photoEncryptionKeyRef;

    @Column(name = "xml_storage_key", length = 500)
    private String xmlStorageKey;

    @Column(name = "signature_valid")
    @Builder.Default
    private Boolean signatureValid = false;

    @Column(name = "uidai_response_code", length = 10)
    private String uidaiResponseCode;

    @Column(name = "auth_code", length = 100)
    private String authCode;

    @Column(name = "verified_at", columnDefinition = "timestamptz")
    private Instant verifiedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ip_metadata", columnDefinition = "jsonb")
    private Map<String, Object> ipMetadata;
}
