package com.los.decision.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "decision_history", schema = "decision")
public class DecisionHistory extends BaseEntity {

    @Column(name = "decision_id", nullable = false)
    private String decisionId;

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_before", length = 50)
    private DecisionStatus statusBefore;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_after", length = 50)
    private DecisionStatus statusAfter;

    @Column(name = "changed_by", length = 100)
    private String changedBy;

    @Column(name = "change_reason", length = 500)
    private String changeReason;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;
}
