package com.los.integration.controller;

import com.los.integration.dto.*;
import com.los.integration.entity.*;
import com.los.integration.service.*;
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
@RequestMapping("/api/integration")
@RequiredArgsConstructor
@Tag(name = "Integration", description = "Third-party integration APIs (Bureau, ONUS, NACH, Disbursement)")
@SecurityRequirement(name = "bearerAuth")
public class IntegrationController {

    private final BureauIntegrationService bureauIntegrationService;
    private final OnusService onusService;
    private final NachService nachService;
    private final DisbursementService disbursementService;

    @PostMapping("/bureau/pull")
    @Operation(summary = "Call credit bureau", description = "Pull credit score from bureau provider")
    public ResponseEntity<ApiResponse<BureauScore>> pullBureauData(
            @Valid @RequestBody PullBureauDto dto) {
        log.info("POST /api/integration/bureau/pull - Application: {}", dto.getApplicationId());

        BureauScore result = bureauIntegrationService.pullBureauData(dto);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(result, "Bureau data pull initiated"));
    }

    @PostMapping("/onus/check")
    @Operation(summary = "AML/sanctions check", description = "Perform ONUS (AML/sanctions) check")
    public ResponseEntity<ApiResponse<OnusCheck>> performOnusCheck(
            @Valid @RequestBody OnusCheckDto dto) {
        log.info("POST /api/integration/onus/check - Application: {}", dto.getApplicationId());

        OnusCheck result = onusService.performOnusCheck(dto);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(result, "ONUS check initiated"));
    }

    @PostMapping("/nach/create")
    @Operation(summary = "Create NACH mandate", description = "Create NACH mandate for auto-debit")
    public ResponseEntity<ApiResponse<NachMandate>> createNachMandate(
            @Valid @RequestBody NachMandateDto dto) {
        log.info("POST /api/integration/nach/create - Application: {}", dto.getApplicationId());

        NachMandate result = nachService.createNachMandate(dto);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(result, "NACH mandate created"));
    }

    @PostMapping("/disburse")
    @Operation(summary = "Trigger disbursement", description = "Process loan disbursement")
    public ResponseEntity<ApiResponse<DisbursementRecord>> createDisbursement(
            @Valid @RequestBody DisbursementDto dto) {
        log.info("POST /api/integration/disburse - Loan: {}", dto.getLoanId());

        DisbursementRecord result = disbursementService.createDisbursement(dto);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(result, "Disbursement initiated"));
    }

    @GetMapping("/bureau/{applicationId}")
    @Operation(summary = "Get bureau scores", description = "Retrieve all bureau scores for application")
    public ResponseEntity<ApiResponse<List<BureauScore>>> getBureauScores(
            @PathVariable String applicationId) {
        log.info("GET /api/integration/bureau/{} - Fetching scores", applicationId);

        List<BureauScore> result = bureauIntegrationService.getBureauScores(applicationId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(result, "Bureau scores retrieved"));
    }

    @GetMapping("/onus/{applicationId}")
    @Operation(summary = "Get ONUS check", description = "Retrieve ONUS check result")
    public ResponseEntity<ApiResponse<OnusCheck>> getOnusCheck(
            @PathVariable String applicationId) {
        log.info("GET /api/integration/onus/{} - Fetching result", applicationId);

        OnusCheck result = onusService.getOnusCheck(applicationId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(result, "ONUS check retrieved"));
    }

    @GetMapping("/disburse/{loanId}")
    @Operation(summary = "Get disbursements", description = "List all disbursements for loan")
    public ResponseEntity<ApiResponse<List<DisbursementRecord>>> getDisbursements(
            @PathVariable String loanId) {
        log.info("GET /api/integration/disburse/{} - Fetching disbursements", loanId);

        List<DisbursementRecord> result = disbursementService.getDisbursementsByLoan(loanId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(result, "Disbursements retrieved"));
    }
}
