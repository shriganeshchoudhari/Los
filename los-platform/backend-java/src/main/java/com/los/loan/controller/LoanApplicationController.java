package com.los.loan.controller;

import com.los.loan.dto.*;
import com.los.loan.service.LoanApplicationService;
import com.los.loan.service.SanctionLetterService;
import com.los.loan.service.PddService;
import com.los.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/loan")
@RequiredArgsConstructor
@Tag(name = "Loan", description = "Loan application management endpoints")
public class LoanApplicationController {

    private final LoanApplicationService loanApplicationService;
    private final SanctionLetterService sanctionLetterService;
    private final PddService pddService;

    /**
     * Create new loan application
     */
    @PostMapping("/applications")
    @Operation(summary = "Create Loan Application", description = "Create a new loan application")
    public ResponseEntity<ApiResponse<ApplicationResponseDto>> createApplication(
            @Valid @RequestBody CreateLoanApplicationDto dto) {
        log.info("Creating loan application");
        ApiResponse<ApplicationResponseDto> response = loanApplicationService.createApplication(dto);
        return ResponseEntity.ok(response);
    }

    /**
     * Update loan application
     */
    @PutMapping("/applications/{applicationId}")
    @Operation(summary = "Update Loan Application", description = "Update existing loan application")
    public ResponseEntity<ApiResponse<ApplicationResponseDto>> updateApplication(
            @Valid @RequestBody UpdateApplicationDto dto) {
        log.info("Updating loan application");
        ApiResponse<ApplicationResponseDto> response = loanApplicationService.updateApplication(dto);
        return ResponseEntity.ok(response);
    }

    /**
     * Get loan application details
     */
    @GetMapping("/applications/{applicationId}")
    @Operation(summary = "Get Application Details", description = "Get loan application details")
    public ResponseEntity<ApiResponse<ApplicationResponseDto>> getApplication(
            @PathVariable String applicationId) {
        log.info("Getting loan application: {}", applicationId);
        ApiResponse<ApplicationResponseDto> response = loanApplicationService.getApplication(applicationId);
        return ResponseEntity.ok(response);
    }

    /**
     * Submit loan application
     */
    @PostMapping("/applications/{applicationId}/submit")
    @Operation(summary = "Submit Application", description = "Submit loan application for review")
    public ResponseEntity<ApiResponse<Void>> submitApplication(
            @PathVariable String applicationId) {
        log.info("Submitting loan application: {}", applicationId);
        ApiResponse<Void> response = loanApplicationService.submitApplication(applicationId);
        return ResponseEntity.ok(response);
    }

    /**
     * Generate sanction letter
     */
    @PostMapping("/sanction-letter")
    @Operation(summary = "Generate Sanction Letter", description = "Generate sanction letter for approved application")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> generateSanctionLetter(
            @Valid @RequestBody SanctionLetterDto dto) {
        log.info("Generating sanction letter");
        ApiResponse<java.util.Map<String, Object>> response = sanctionLetterService.generateSanctionLetter(dto);
        return ResponseEntity.ok(response);
    }

    /**
     * Get PDD checklist
     */
    @GetMapping("/applications/{applicationId}/pdd")
    @Operation(summary = "Get PDD Checklist", description = "Get post-disbursement documentation checklist")
    public ResponseEntity<ApiResponse<java.util.List<?>>> getPddChecklist(
            @PathVariable String applicationId) {
        log.info("Getting PDD checklist for application: {}", applicationId);
        var checklist = pddService.getPddChecklist(applicationId);
        return ResponseEntity.ok(ApiResponse.success(checklist, "PDD checklist retrieved successfully"));
    }

    /**
     * Complete PDD item
     */
    @PostMapping("/applications/{applicationId}/pdd/{itemCode}/complete")
    @Operation(summary = "Complete PDD Item", description = "Mark PDD item as completed")
    public ResponseEntity<ApiResponse<Void>> completePddItem(
            @PathVariable String applicationId,
            @PathVariable String itemCode) {
        log.info("Completing PDD item");
        ApiResponse<Void> response = pddService.completeItem(applicationId, itemCode);
        return ResponseEntity.ok(response);
    }

    /**
     * Waive PDD item
     */
    @PostMapping("/applications/{applicationId}/pdd/waive")
    @Operation(summary = "Waive PDD Item", description = "Waive PDD item with reason")
    public ResponseEntity<ApiResponse<Void>> waivePddItem(
            @Valid @RequestBody PddWaiveItemDto dto) {
        log.info("Waiving PDD item");
        ApiResponse<Void> response = pddService.waiveItem(dto);
        return ResponseEntity.ok(response);
    }

    /**
     * Get PDD completion status
     */
    @GetMapping("/applications/{applicationId}/pdd/status")
    @Operation(summary = "Get PDD Status", description = "Get PDD completion percentage and status")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getPddStatus(
            @PathVariable String applicationId) {
        log.info("Getting PDD status");
        ApiResponse<java.util.Map<String, Object>> response = pddService.getPddCompletionStatus(applicationId);
        return ResponseEntity.ok(response);
    }
}
