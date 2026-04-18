package com.los.dsa.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DsaDashboardDto {

    private String partnerId;

    private String partnerName;

    private PartnerStatsDto stats;

    private String status;

    private String relationshipManager;

    private Long monthlyTarget;

    private Long monthlyAchieved;

    private Double conversionRate;

    private Integer teamSize;

    private String lastLoginAt;
}
