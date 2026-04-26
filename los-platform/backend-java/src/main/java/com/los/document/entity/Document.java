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

    @Column(name = "user_id", nullable = false)
    private java.util.UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false)
    private DocumentType documentType;

    @Column(name = "category")
    private String category;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "checksum")
    private String checksum;

    @Column(name = "ocr_data", columnDefinition = "jsonb")
    private String ocrData;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status")
    private DocumentStatus verificationStatus;

    @Column(name = "verified_by")
    private java.util.UUID verifiedBy;

    @Column(name = "verified_at")
    private java.time.Instant verifiedAt;
}
