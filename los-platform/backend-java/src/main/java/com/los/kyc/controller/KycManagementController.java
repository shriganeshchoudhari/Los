package com.los.kyc.controller;

import com.los.kyc.service.KycManagementService;
import com.los.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/kyc/manage")
@RequiredArgsConstructor
@Tag(name = "KYC Management", description = "KYC management endpoints for administrators")
public class KycManagementController {

    private final KycManagementService kycManagementService;

    /**
     * Update risk score
     */
    @PostMapping("/{applicationId}/risk-score")
    @Operation(summary = "Update Risk Score", description = "Update KYC risk score for application")
    public ResponseEntity<ApiResponse<Void>> updateRiskScore(
            @PathVariable String applicationId,
            @Valid @RequestBody Map<String, String> request) {
        log.info("Updating risk score for application: {}", applicationId);

        BigDecimal riskScore = new BigDecimal(request.get("riskScore"));
        kycManagementService.updateRiskScore(applicationId, riskScore);

        return ResponseEntity.ok(ApiResponse.success(null, "Risk score updated successfully"));
    }

    /**
     * Reject KYC
     */
    @PostMapping("/{applicationId}/reject")
    @Operation(summary = "Reject KYC", description = "Reject KYC for application with reason")
    public ResponseEntity<ApiResponse<Void>> rejectKyc(
            @PathVariable String applicationId,
            @Valid @RequestBody Map<String, String> request) {
        log.info("Rejecting KYC for application: {}", applicationId);

        String reason = request.get("reason");
        kycManagementService.rejectKyc(applicationId, reason);

        return ResponseEntity.ok(ApiResponse.success(null, "KYC rejected successfully"));
    }

    /**
     * Get KYC by status
     */
    @GetMapping("/status/{status}")
    @Operation(summary = "Get KYC by Status", description = "Get all KYC records with specific status")
    public ResponseEntity<ApiResponse<java.util.List<?>>> getKycByStatus(
            @PathVariable String status) {
        log.info("Getting KYC records with status: {}", status);

        var kycRecords = kycManagementService.getKycByStatus(status);
        return ResponseEntity.ok(ApiResponse.success(kycRecords, "KYC records retrieved successfully"));
    }
}
