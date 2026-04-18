package com.los.document.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "signing_logs", schema = "document")
public class SigningLog extends BaseEntity {

    @Column(name = "document_id", nullable = false)
    private String documentId;

    @Column(name = "signing_request_id", unique = true, length = 100)
    private String signingRequestId;

    @Column(name = "signer_email", length = 200)
    private String signerEmail;

    @Column(name = "signing_status", length = 50)
    private String signingStatus;

    @Column(name = "signed_at")
    private String signedAt;

    @Column(name = "signature_provider", length = 100)
    private String signatureProvider;

    @Column(name = "signature_certificate_id", length = 200)
    private String signatureCertificateId;

    @Column(name = "signature_timestamp")
    private String signatureTimestamp;

    @Column(name = "response_data", columnDefinition = "jsonb")
    private String responseData;

    @Column(name = "error_message", length = 500)
    private String errorMessage;
}
