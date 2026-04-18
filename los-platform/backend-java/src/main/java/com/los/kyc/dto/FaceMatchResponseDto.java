package com.los.kyc.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FaceMatchResponseDto {

    private String transactionId;

    private String status;

    private java.math.BigDecimal matchScore;

    private String confidenceLevel;

    private String message;
}
