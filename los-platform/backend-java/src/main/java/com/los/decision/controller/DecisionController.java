package com.los.decision.controller;

import com.los.decision.dto.*;
import com.los.decision.entity.DecisionHistory;
import com.los.decision.service.DecisionEngineService;
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
@RequestMapping("/api/decisions")
@RequiredArgsConstructor
@Tag(name = "Decision Engine", description = "Decision Engine APIs for credit decisions")
@SecurityRequirement(name = "bearerAuth")
public class DecisionController {

    private final DecisionEngineService decisionEngineService;

    @PostMapping("/trigger")
    @Operation(summary = "Trigger credit decision for application", description = "Run decision engine to determine loan approval/rejection")
    public ResponseEntity<ApiResponse<DecisionResponseDto>> triggerDecision(
            @Valid @RequestBody TriggerDecisionDto dto) {
        log.info("POST /api/decisions/trigger - Application: {}", dto.getApplicationId());

        DecisionResponseDto response = decisionEngineService.triggerDecision(dto);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Decision triggered successfully"));
    }

    @GetMapping("/{applicationId}")
    @Operation(summary = "Get decision for application", description = "Retrieve decision details for specific application")
    public ResponseEntity<ApiResponse<DecisionResponseDto>> getDecision(
            @PathVariable String applicationId) {
        log.info("GET /api/decisions/{} - Fetching decision", applicationId);

        DecisionResponseDto response = decisionEngineService.getDecision(applicationId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Decision retrieved successfully"));
    }

    @PostMapping("/override")
    @Operation(summary = "Manual override of decision", description = "Override decision with manual approval/rejection")
    public ResponseEntity<ApiResponse<DecisionResponseDto>> manualOverride(
            @Valid @RequestBody ManualDecisionDto dto,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {
        log.info("POST /api/decisions/override - Application: {}", dto.getApplicationId());

        String userId = (headerUserId != null) ? headerUserId : com.los.common.security.SecurityConstants.SYSTEM_USER;
        DecisionResponseDto response = decisionEngineService.manualOverride(dto, userId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Decision overridden successfully"));
    }

    @PostMapping("/override/request")
    @Operation(summary = "Request manual override", description = "Create override request (maker in maker-checker flow)")
    public ResponseEntity<ApiResponse<DecisionResponseDto>> requestOverride(
            @Valid @RequestBody OverrideRequestDto dto,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {
        log.info("POST /api/decisions/override/request - Application: {}", dto.getApplicationId());

        String userId = (headerUserId != null) ? headerUserId : com.los.common.security.SecurityConstants.SYSTEM_USER;
        DecisionResponseDto response = decisionEngineService.requestOverride(dto, userId);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Override request created successfully"));
    }

    @GetMapping("/rules")
    @Operation(summary = "List all active decision rules", description = "Get list of all active rules for admin")
    public ResponseEntity<ApiResponse<List<RuleListDto>>> listRules() {
        log.info("GET /api/decisions/rules - Listing all rules");

        List<RuleListDto> rules = decisionEngineService.listRules();
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(rules, "Rules retrieved successfully"));
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "Get decisions by status", description = "Retrieve all decisions with specific status")
    public ResponseEntity<ApiResponse<List<DecisionResponseDto>>> getDecisionsByStatus(
            @PathVariable String status) {
        log.info("GET /api/decisions/status/{} - Fetching decisions", status);

        List<DecisionResponseDto> decisions = decisionEngineService.getDecisionsByStatus(status);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(decisions, "Decisions retrieved successfully"));
    }

    @GetMapping("/{applicationId}/history")
    @Operation(summary = "Get decision history", description = "Retrieve audit trail of decision changes")
    public ResponseEntity<ApiResponse<List<DecisionHistory>>> getDecisionHistory(
            @PathVariable String applicationId) {
        log.info("GET /api/decisions/{}/history - Fetching history", applicationId);

        List<DecisionHistory> history = decisionEngineService.getDecisionHistory(applicationId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(history, "Decision history retrieved successfully"));
    }
}
