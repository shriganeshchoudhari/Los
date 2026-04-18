package com.los.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * Auditable entity extends BaseEntity with additional audit fields.
 * Tracks who created and modified records.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@MappedSuperclass
public abstract class AuditableEntity extends BaseEntity {

    @Column(name = "created_by", updatable = false, length = 100)
    private String createdBy;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @Column(name = "deleted_by", length = 100)
    private String deletedBy;

    @Column(name = "deleted_at", columnDefinition = "TIMESTAMP WITH TIME ZONE")
    private java.time.LocalDateTime deletedAt;

    public void markDeleted(String deletedBy) {
        this.isDeleted = true;
        this.deletedBy = deletedBy;
        this.deletedAt = java.time.LocalDateTime.now();
    }
}
