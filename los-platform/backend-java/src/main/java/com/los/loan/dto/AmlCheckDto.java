package com.los.loan.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AmlCheckDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotBlank(message = "Customer name is required")
    private String customerName;

    private String panNumber;

    private String aadhaarNumber;

    private String riskLevel; // LOW, MEDIUM, HIGH

    private String remark;
}
