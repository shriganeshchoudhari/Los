package com.los.loan.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationResponseDto {

    private String applicationId;

    private String applicationNumber;

    private String status;

    private String message;

    private java.time.LocalDateTime createdAt;

    private java.util.Map<String, Object> data;
}
