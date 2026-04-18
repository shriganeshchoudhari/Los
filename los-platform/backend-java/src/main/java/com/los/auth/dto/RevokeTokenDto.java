package com.los.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RevokeTokenDto {

    @NotBlank(message = "Token or JTI is required")
    private String tokenOrJti;

    private String reason;
}
