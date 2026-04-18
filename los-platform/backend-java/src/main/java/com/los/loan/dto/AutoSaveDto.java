package com.los.loan.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AutoSaveDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    private java.util.Map<String, Object> formData;

    private String sectionName;

    private Integer completionPercentage;
}
