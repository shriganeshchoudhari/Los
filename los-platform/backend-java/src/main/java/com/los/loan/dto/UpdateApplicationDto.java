package com.los.loan.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateApplicationDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    private String loanType;

    private BigDecimal requestedAmount;

    private String employmentType;

    private BigDecimal annualIncome;

    private String purpose;

    private java.util.Map<String, Object> additionalData;
}
