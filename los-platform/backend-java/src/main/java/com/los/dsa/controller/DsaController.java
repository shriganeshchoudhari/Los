package com.los.dsa.controller;

import com.los.dsa.dto.*;
import com.los.dsa.service.*;
import com.los.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/dsa")
@RequiredArgsConstructor
@Tag(name = "DSA", description = "DSA/Partner Portal APIs")
@SecurityRequirement(name = "bearerAuth")
public class DsaController {

    private final DsaAuthService dsaAuthService;
    private final ResourceService resourceService;
    private final ActivityTrackingService activityTrackingService;
    private final PartnerReportService partnerReportService;

    @PostMapping("/auth/login")
    @Operation(summary = "Partner login", description = "DSA partner login")
    public ResponseEntity<ApiResponse<Object>> login(
            @Valid @RequestBody DsaLoginDto dto) {
        log.info("POST /api/dsa/auth/login - Partner: {}", dto.getPartnerCode());

        var partner = dsaAuthService.authenticate(dto);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(partner, "Partner logged in successfully"));
    }

    @GetMapping("/dashboard/{partnerId}")
    @Operation(summary = "Partner dashboard", description = "Get partner dashboard data")
    public ResponseEntity<ApiResponse<DsaDashboardDto>> getDashboard(
            @PathVariable String partnerId) {
        log.info("GET /api/dsa/dashboard/{} - Fetching dashboard", partnerId);

        var partner = dsaAuthService.getPartner(partnerId);
        DsaDashboardDto dashboard = new DsaDashboardDto();
        dashboard.setPartnerId(partnerId);
        dashboard.setPartnerName(partner.getPartnerName());
        dashboard.setStatus(partner.getStatus().toString());

        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(dashboard, "Dashboard retrieved successfully"));
    }

    @PostMapping("/resources/assign")
    @Operation(summary = "Assign loan officers", description = "Assign loan officers/resources to partner")
    public ResponseEntity<ApiResponse<Object>> assignResource(
            @Valid @RequestBody ResourceAssignmentDto dto) {
        log.info("POST /api/dsa/resources/assign - Partner: {}", dto.getPartnerId());

        var resource = resourceService.assignResource(dto);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(resource, "Resource assigned successfully"));
    }

    @GetMapping("/resources/{partnerId}")
    @Operation(summary = "Get partner resources", description = "Get all resources for partner")
    public ResponseEntity<ApiResponse<List<?>>> getResources(
            @PathVariable String partnerId) {
        log.info("GET /api/dsa/resources/{} - Fetching resources", partnerId);

        var resources = resourceService.getResourcesByPartner(partnerId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(resources, "Resources retrieved successfully"));
    }

    @GetMapping("/activities/{partnerId}")
    @Operation(summary = "Partner activities", description = "Get partner activities log")
    public ResponseEntity<ApiResponse<List<?>>> getActivities(
            @PathVariable String partnerId) {
        log.info("GET /api/dsa/activities/{} - Fetching activities", partnerId);

        var activities = activityTrackingService.getActivities(partnerId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(activities, "Activities retrieved successfully"));
    }

    @GetMapping("/reports/{partnerId}")
    @Operation(summary = "Performance reports", description = "Get partner performance reports")
    public ResponseEntity<ApiResponse<ActivityReportDto>> getReports(
            @PathVariable String partnerId,
            @RequestParam(defaultValue = "MONTH") String period) {
        log.info("GET /api/dsa/reports/{} - Fetching reports", partnerId);

        var report = partnerReportService.generateActivityReport(partnerId, period);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(report, "Reports retrieved successfully"));
    }

    @GetMapping("/stats/{partnerId}")
    @Operation(summary = "Get partner stats", description = "Get partner statistics")
    public ResponseEntity<ApiResponse<PartnerStatsDto>> getStats(
            @PathVariable String partnerId) {
        log.info("GET /api/dsa/stats/{} - Fetching stats", partnerId);

        var partner = dsaAuthService.getPartner(partnerId);
        var stats = partnerReportService.getPartnerStats(partnerId, partner.getPartnerName());
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(stats, "Stats retrieved successfully"));
    }
}
