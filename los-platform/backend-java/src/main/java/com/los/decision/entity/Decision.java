package com.los.decision.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@EqualsAndHashCode(callSuper = false)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "decisions", schema = "decision")
public class Decision extends BaseEntity {

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    private DecisionStatus status = DecisionStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision_type", nullable = false, length = 30)
    private DecisionType decisionType;

    @Column(name = "final_decision", length = 20)
    private String finalDecision;

    @Column(name = "approved_amount")
    private BigDecimal approvedAmount;

    @Column(name = "approved_tenure_months")
    private Integer approvedTenureMonths;

    @Column(name = "interest_rate_bps")
    private Integer interestRateBps;

    @Column(name = "spread_bps")
    private Integer spreadBps;

    @Column(name = "benchmark_rate", length = 50)
    private String benchmarkRate;

    @Column(name = "processing_fee_paisa")
    private Long processingFeePaisa = 0L;

    @Column(name = "insurance_mandatory")
    private Boolean insuranceMandatory = false;

    @Column(name = "ltv_ratio", precision = 5, scale = 2)
    private BigDecimal ltvRatio;

    @Column(name = "foir_actual", precision = 5, scale = 2)
    private BigDecimal foirActual;

    @Column(name = "scorecard_result", columnDefinition = "jsonb")
    private String scorecardResult;

    @Column(name = "conditions", columnDefinition = "jsonb")
    private String conditions;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "decided_by")
    private String decidedBy;

    @Column(name = "remarks", length = 1000)
    private String remarks;
}
