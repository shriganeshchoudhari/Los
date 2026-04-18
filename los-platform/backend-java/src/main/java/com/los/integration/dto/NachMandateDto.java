package com.los.integration.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NachMandateDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotBlank(message = "Loan ID is required")
    private String loanId;

    @NotBlank(message = "Account number is required")
    private String accountNumber;

    @NotBlank(message = "IFSC code is required")
    private String ifscCode;

    @NotBlank(message = "Bank name is required")
    private String bankName;

    @NotBlank(message = "Account holder name is required")
    private String accountHolderName;

    private Long mandateAmount;

    private String startDate;

    private String endDate;
}
