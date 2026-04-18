package com.los.kyc.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Response DTO for Aadhaar KYC initiation")
public class AadhaarInitResponseDto {

    @Schema(description = "Transaction ID", example = "TXN-20240101-001")
    private String txnId;

    @Schema(description = "UIDAI reference ID")
    private String uidaiRefId;

    @Schema(description = "OTP expiry time in seconds", example = "300")
    private Integer expiresIn;
}
