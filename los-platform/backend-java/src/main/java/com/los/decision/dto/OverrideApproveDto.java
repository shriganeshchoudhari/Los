package com.los.decision.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OverrideApproveDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotNull(message = "Approval flag is required")
    private Boolean approved;

    private String approverComments;

    private String rejectionComments;
}
