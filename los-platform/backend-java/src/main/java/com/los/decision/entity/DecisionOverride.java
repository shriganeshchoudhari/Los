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
@Table(name = "decision_overrides", schema = "decision")
public class DecisionOverride extends BaseEntity {

    @Column(name = "decision_id", nullable = false)
    private String decisionId;

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "requested_decision", length = 50)
    private String requestedDecision;

    @Column(name = "override_status", length = 50)
    private String overrideStatus;

    @Column(name = "requested_by", length = 100)
    private String requestedBy;

    @Column(name = "approved_by", length = 100)
    private String approvedBy;

    @Column(name = "justification", length = 1000)
    private String justification;

    @Column(name = "approver_comments", length = 1000)
    private String approverComments;
}
