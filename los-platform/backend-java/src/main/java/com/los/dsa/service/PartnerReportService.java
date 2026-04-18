package com.los.dsa.service;

import com.los.dsa.dto.ActivityReportDto;
import com.los.dsa.dto.PartnerStatsDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class PartnerReportService {

    public ActivityReportDto generateActivityReport(String partnerId, String reportPeriod) {
        log.info("Generating activity report for partner: {}, period: {}", partnerId, reportPeriod);

        ActivityReportDto report = new ActivityReportDto();
        report.setReportId(UUID.randomUUID().toString());
        report.setPartnerId(partnerId);
        report.setReportPeriod(reportPeriod);
        report.setGeneratedAt(LocalDateTime.now().toString());
        report.setTotalApplicationsCreated(0L);
        report.setApprovedApplications(0L);
        report.setRejectedApplications(0L);
        report.setPendingApplications(0L);
        report.setTotalLoanAmount(0L);
        report.setConversionRate(0.0);

        return report;
    }

    public PartnerStatsDto getPartnerStats(String partnerId, String partnerName) {
        log.info("Getting partner stats for: {}", partnerId);

        PartnerStatsDto stats = new PartnerStatsDto();
        stats.setPartnerId(partnerId);
        stats.setPartnerName(partnerName);
        stats.setStatus("ACTIVE");
        stats.setTotalTeamMembers(0);
        stats.setTotalApplicationsCreated(0L);
        stats.setApprovedLoans(0L);
        stats.setRejectedLoans(0L);
        stats.setPendingApplications(0L);
        stats.setTotalDisbursedAmount(0L);
        stats.setConversionRate(0.0);
        stats.setCreatedAt(LocalDateTime.now().toString());

        return stats;
    }
}
