package com.los.decision.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RuleEvaluationDto {

    @NotBlank(message = "Rule code is required")
    private String ruleCode;

    private String ruleResult;

    private Boolean passed;

    private String evaluationDetails;
}
