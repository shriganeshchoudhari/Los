package com.los.decision.dto;

import com.los.decision.entity.DecisionStatus;
import com.los.decision.entity.DecisionType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DecisionResponseDto {

    private String id;

    private String applicationId;

    private DecisionStatus status;

    private DecisionType decisionType;

    private String decision;

    private BigDecimal approvedAmount;

    private Integer approvedTenureMonths;

    private Integer interestRateBps;

    private Integer spreadBps;

    private String benchmarkRate;

    private Long processingFeePaisa;

    private Boolean insuranceMandatory;

    private BigDecimal ltvRatio;

    private BigDecimal foirActual;

    private String scorecardResult;

    private String conditions;

    private String rejectionReason;

    private LocalDateTime decidedAt;

    private String decidedBy;

    private String remarks;
}
