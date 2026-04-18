package com.los.kyc.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PanResponseDto {

    private String transactionId;

    private String status;

    private String panNumber;

    private String name;

    private java.math.BigDecimal matchScore;

    private String message;
}
