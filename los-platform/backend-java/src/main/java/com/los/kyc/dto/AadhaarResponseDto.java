package com.los.kyc.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AadhaarResponseDto {

    private String transactionId;

    private String status;

    private String aadhaarNumber;

    private String name;

    private String dob;

    private String gender;

    private String address;

    private String message;
}
