package com.los.decision.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DecisionHistoryDto {

    private String id;

    private String decisionId;

    private String applicationId;

    private String statusBefore;

    private String statusAfter;

    private String changedBy;

    private String changeReason;

    private String createdAt;
}
