package com.los.loan.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatusResponseDto {

    private String applicationId;

    private String applicationStatus;

    private String message;

    private java.util.Map<String, Object> statusDetails;

    private java.time.LocalDateTime lastUpdatedAt;
}
