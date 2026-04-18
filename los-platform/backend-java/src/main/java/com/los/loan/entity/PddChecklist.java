package com.los.loan.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "pdd_checklist", schema = "loan", indexes = {
    @Index(name = "idx_pdd_checklist_application_id", columnList = "application_id")
})
public class PddChecklist extends BaseEntity {

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "item_code", nullable = false, length = 50)
    private String itemCode;

    @Column(name = "item_description", length = 255)
    private String itemDescription;

    @Column(name = "is_completed", nullable = false)
    private Boolean isCompleted = false;

    @Column(name = "completion_date")
    private java.time.LocalDate completionDate;

    @Column(name = "is_waived", nullable = false)
    private Boolean isWaived = false;

    @Column(name = "waiver_reason", length = 500)
    private String waiverReason;

    @Column(name = "remarks", length = 500)
    private String remarks;

    @Column(name = "document_url", length = 500)
    private String documentUrl;
}
