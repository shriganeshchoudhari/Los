package com.los.integration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DisbursementDto {

    @NotBlank(message = "Loan ID is required")
    private String loanId;

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotNull(message = "Amount is required")
    private BigDecimal amount;

    @NotBlank(message = "Disbursement mode is required")
    private String disbursementMode;

    @NotBlank(message = "Account number is required")
    private String accountNumber;

    @NotBlank(message = "IFSC code is required")
    private String ifscCode;

    @NotBlank(message = "Bank name is required")
    private String bankName;

    private Integer trancheNumber;

    private String scheduledDate;
}
