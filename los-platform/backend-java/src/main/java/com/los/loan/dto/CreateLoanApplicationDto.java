package com.los.loan.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateLoanApplicationDto {

    @NotNull(message = "Customer ID is required")
    private String customerId;

    @NotBlank(message = "Loan type is required")
    private String loanType;

    @NotNull(message = "Requested amount is required")
    @Positive(message = "Requested amount must be positive")
    private BigDecimal requestedAmount;

    private String employmentType;

    private BigDecimal annualIncome;

    private String purpose;

    private String collateral;
}
