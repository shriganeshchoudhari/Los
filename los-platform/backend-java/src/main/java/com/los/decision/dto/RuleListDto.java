package com.los.decision.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RuleListDto {

    private String id;

    private String ruleCode;

    private String ruleName;

    private Integer priority;

    private Boolean isActive;

    private String productType;

    private Integer version;

    private String description;
}
