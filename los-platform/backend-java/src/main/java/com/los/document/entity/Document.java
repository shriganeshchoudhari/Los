package com.los.document.entity;

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
@Table(name = "documents", schema = "document")
public class Document extends BaseEntity {

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "document_name", nullable = false, length = 200)
    private String documentName;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false)
    private DocumentType documentType;

    @Column(name = "s3_key", nullable = false, length = 500)
    private String s3Key;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "file_extension", length = 20)
    private String fileExtension;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private DocumentStatus status = DocumentStatus.UPLOADED;

    @Column(name = "uploaded_by", length = 100)
    private String uploadedBy;

    @Column(name = "verified_by", length = 100)
    private String verifiedBy;

    @Column(name = "verification_remarks", length = 500)
    private String verificationRemarks;

    @Column(name = "expiry_date")
    private String expiryDate;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "tags", length = 500)
    private String tags;
}
