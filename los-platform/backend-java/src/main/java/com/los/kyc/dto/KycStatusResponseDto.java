package com.los.kyc.dto;

import com.los.kyc.entity.KycRecord;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "DTO for KYC status response")
public class KycStatusResponseDto {

    @Schema(description = "KYC record ID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String kycId;

    @Schema(description = "Current KYC status", example = "AADHAAR_VERIFIED")
    private KycRecord.KycStatus status;

    @Schema(description = "Overall risk score (0-100)", example = "35")
    private Integer overallRiskScore;

    @Schema(description = "Whether Aadhaar is verified", example = "true")
    private Boolean aadhaarVerified;

    @Schema(description = "Whether PAN is verified", example = "false")
    private Boolean panVerified;

    @Schema(description = "Whether face match passed", example = "false")
    private Boolean faceMatched;
}
