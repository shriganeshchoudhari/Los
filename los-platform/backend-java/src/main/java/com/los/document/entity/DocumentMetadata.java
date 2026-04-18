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
@Table(name = "document_metadata", schema = "document")
public class DocumentMetadata extends BaseEntity {

    @Column(name = "document_id", nullable = false)
    private String documentId;

    @Column(name = "metadata_key", length = 100)
    private String metadataKey;

    @Column(name = "metadata_value", length = 500)
    private String metadataValue;

    @Column(name = "extraction_status", length = 50)
    private String extractionStatus;

    @Column(name = "ocr_confidence")
    private Double ocrConfidence;

    @Column(name = "extracted_text", columnDefinition = "text")
    private String extractedText;

    @Column(name = "data_json", columnDefinition = "jsonb")
    private String dataJson;
}
