package com.los.loan.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SanctionLetterDto {

    private String applicationId;

    private BigDecimal sanctionAmount;

    private Integer tenureMonths;

    private Integer interestRateBps;

    private String processingFeePercentage;

    private String insuranceType;

    private String insuranceProvider;

    private java.util.List<String> conditions;
}
