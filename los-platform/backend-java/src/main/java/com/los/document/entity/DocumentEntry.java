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
@Table(name = "document_entries", schema = "document")
public class DocumentEntry extends BaseEntity {

    @Column(name = "document_id", nullable = false)
    private String documentId;

    @Column(name = "entry_name", length = 200)
    private String entryName;

    @Column(name = "entry_type", length = 50)
    private String entryType;

    @Column(name = "storage_path", length = 500)
    private String storagePath;

    @Column(name = "version_number")
    private Integer versionNumber = 1;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;
}
