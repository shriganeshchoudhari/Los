package com.los.dsa.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PartnerStatsDto {

    private String partnerId;

    private String partnerName;

    private String status;

    private Integer totalTeamMembers;

    private Long totalApplicationsCreated;

    private Long approvedLoans;

    private Long rejectedLoans;

    private Long pendingApplications;

    private Long totalDisbursedAmount;

    private Double conversionRate;

    private String lastActivityDate;

    private String createdAt;
}
