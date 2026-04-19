package com.los.loan.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateApplicationDto {

    // Set from path variable by the controller — not required in JSON body
    private String applicationId;

    private String loanType;

    private BigDecimal requestedAmount;

    private String employmentType;

    private BigDecimal annualIncome;

    private String purpose;

    private java.util.Map<String, Object> additionalData;
}
