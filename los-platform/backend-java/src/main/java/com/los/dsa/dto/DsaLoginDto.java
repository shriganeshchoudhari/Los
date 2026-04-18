package com.los.dsa.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DsaLoginDto {

    @NotBlank(message = "Partner code is required")
    private String partnerCode;

    @NotBlank(message = "Password is required")
    private String password;

    private String deviceFingerprint;
}
