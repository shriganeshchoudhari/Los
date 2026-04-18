package com.los.auth.dto;

import com.los.common.enums.OtpPurpose;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SendOtpDto {

    @NotBlank(message = "Mobile number is required")
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid mobile number format")
    private String mobile;

    @NotNull(message = "OTP purpose is required")
    private OtpPurpose purpose;

    private String channel; // SMS, WHATSAPP, EMAIL - default SMS

    private String deviceFingerprint;

    private String ipAddress;

    private String userAgent;
}
