package com.los.loan.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PddWaiveItemDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotBlank(message = "Item code is required")
    private String itemCode;

    @NotBlank(message = "Waiver reason is required")
    private String waiverReason;

    private String approvalId;
}
