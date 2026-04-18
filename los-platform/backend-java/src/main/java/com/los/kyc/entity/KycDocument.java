package com.los.kyc.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "kyc_documents", schema = "kyc", indexes = {
    @Index(name = "idx_kyc_documents_kyc_record_id", columnList = "kyc_record_id")
})
public class KycDocument extends BaseEntity {

    @Column(name = "kyc_record_id", nullable = false)
    private String kycRecordId;

    @Column(name = "document_type", nullable = false, length = 100)
    private String documentType; // AADHAAR, PAN, PASSPORT, etc.

    @Column(name = "document_number", length = 50)
    private String documentNumber;

    @Column(name = "document_url", length = 500)
    private String documentUrl;

    @Column(name = "status", length = 50)
    private String status; // UPLOADED, VERIFIED, REJECTED

    @Column(name = "upload_date")
    private java.time.LocalDateTime uploadDate;

    @Column(name = "expiry_date")
    private java.time.LocalDate expiryDate;

    @Column(name = "is_verified")
    private Boolean isVerified = false;

    @Column(name = "verification_remarks", length = 500)
    private String verificationRemarks;
}
