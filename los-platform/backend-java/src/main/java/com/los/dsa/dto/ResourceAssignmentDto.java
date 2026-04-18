package com.los.dsa.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceAssignmentDto {

    @NotBlank(message = "Partner ID is required")
    private String partnerId;

    @NotBlank(message = "User ID is required")
    private String userId;

    @NotBlank(message = "User name is required")
    private String userName;

    @NotBlank(message = "Designation is required")
    private String designation;

    @NotBlank(message = "Email is required")
    private String email;

    @NotBlank(message = "Mobile is required")
    private String mobile;

    @NotNull(message = "Role is required")
    private String role;
}
