package com.los.dsa.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActivityReportDto {

    private String reportId;

    private String partnerId;

    private Long totalApplicationsCreated;

    private Long approvedApplications;

    private Long rejectedApplications;

    private Long pendingApplications;

    private Long totalLoanAmount;

    private Double conversionRate;

    private String reportPeriod;

    private String generatedAt;
}
