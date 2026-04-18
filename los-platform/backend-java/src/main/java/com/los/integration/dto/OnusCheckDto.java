package com.los.integration.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OnusCheckDto {

    @NotBlank(message = "Application ID is required")
    private String applicationId;

    @NotBlank(message = "Applicant ID is required")
    private String applicantId;

    @NotBlank(message = "PAN is required")
    private String pan;

    @NotBlank(message = "Name is required")
    private String name;

    private String dateOfBirth;

    private String checkType;
}
