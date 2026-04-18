package com.los.decision.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OverrideRequestResponseDto {

    private String id;

    private String applicationId;

    private String requestedDecision;

    private String justification;

    private String status;

    private String createdAt;
}
