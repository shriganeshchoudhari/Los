package com.los.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponseDto {

    private String accessToken;

    private String refreshToken;

    private Long expiresIn; // in seconds

    private String tokenType = "Bearer";

    private String scope;

    private String userId;

    private String role;

    private String mfaRequired = "false";

    private String mfaType; // TOTP, SMS, EMAIL
}
