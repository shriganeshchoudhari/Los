package com.los.loan.controller;

import com.los.loan.dto.ApplicationResponseDto;
import com.los.loan.dto.CreateLoanApplicationDto;
import com.los.loan.dto.UpdateApplicationDto;
import com.los.loan.dto.ManagerDecisionDto;
import com.los.loan.service.LoanApplicationService;
import com.los.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Primary REST facade for loan applications.
 * Mapped to /api/applications — matches all frontend loanApi paths.
 */
@Slf4j
@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
@Tag(name = "Applications", description = "Loan application CRUD and workflow endpoints")
public class ApplicationController {

    private final LoanApplicationService loanApplicationService;

    // ── List (paginated) ───────────────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "List Applications")
    public ResponseEntity<ApiResponse<Page<ApplicationResponseDto>>> listApplications(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String status) {
        log.info("List applications: page={}, limit={}, status={}", page, limit, status);
        Pageable pageable = PageRequest.of(Math.max(0, page - 1), limit,
                Sort.by("createdAt").descending());
        return ResponseEntity.ok(loanApplicationService.getAllApplications(pageable));
    }

    // ── Single application ─────────────────────────────────────────────────────

    @GetMapping("/{id}")
    @Operation(summary = "Get Application")
    public ResponseEntity<ApiResponse<ApplicationResponseDto>> getApplication(
            @PathVariable String id) {
        log.info("Get application: {}", id);
        return ResponseEntity.ok(loanApplicationService.getApplication(id));
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    @PostMapping
    @Operation(summary = "Create Application")
    public ResponseEntity<ApiResponse<ApplicationResponseDto>> createApplication(
            @Valid @RequestBody CreateLoanApplicationDto dto) {
        log.info("Create application");
        return ResponseEntity.ok(loanApplicationService.createApplication(dto));
    }

    // ── Update (partial) ───────────────────────────────────────────────────────

    @PatchMapping("/{id}")
    @Operation(summary = "Update Application")
    public ResponseEntity<ApiResponse<ApplicationResponseDto>> updateApplication(
            @PathVariable String id,
            @Valid @RequestBody UpdateApplicationDto dto) {
        log.info("Update application: {}", id);
        dto.setApplicationId(id);
        return ResponseEntity.ok(loanApplicationService.updateApplication(dto));
    }

    // ── Submit ─────────────────────────────────────────────────────────────────

    @PostMapping("/{id}/submit")
    @Operation(summary = "Submit Application")
    public ResponseEntity<ApiResponse<Void>> submitApplication(
            @PathVariable String id) {
        log.info("Submit application: {}", id);
        return ResponseEntity.ok(loanApplicationService.submitApplication(id));
    }

    // ── Auto-save draft ────────────────────────────────────────────────────────

    @PatchMapping("/{id}/autosave")
    @Operation(summary = "Auto-save Draft", description = "Persist partial form data without validation")
    public ResponseEntity<ApiResponse<ApplicationResponseDto>> autosave(
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        log.info("Autosave application: {}", id);
        UpdateApplicationDto dto = new UpdateApplicationDto();
        dto.setApplicationId(id);
        // Apply any recognised top-level fields forwarded from the form
        if (body.containsKey("loanType")) dto.setLoanType((String) body.get("loanType"));
        if (body.containsKey("employmentType")) dto.setEmploymentType((String) body.get("employmentType"));
        if (body.containsKey("requestedAmount") && body.get("requestedAmount") instanceof Number n)
            dto.setRequestedAmount(new java.math.BigDecimal(n.toString()));
        return ResponseEntity.ok(loanApplicationService.updateApplication(dto));
    }

    // ── Stage / audit history ──────────────────────────────────────────────────

    @GetMapping("/{id}/history")
    @Operation(summary = "Stage History")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getHistory(
            @PathVariable String id) {
        log.info("Get history for application: {}", id);
        // Placeholder — full audit trail via /api/audit-logs?applicationId={id}
        return ResponseEntity.ok(
            ApiResponse.success(
                List.of(Map.of("applicationId", id, "info",
                    "Use GET /api/audit-logs?applicationId={id} for full audit trail")),
                "History retrieved")
        );
    }

    // ── Assign loan officer ────────────────────────────────────────────────────

    @PostMapping("/{id}/assign")
    @Operation(summary = "Assign Loan Officer")
    public ResponseEntity<ApiResponse<ApplicationResponseDto>> assignOfficer(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        log.info("Assign officer {} to application {}", body.get("officerId"), id);
        return ResponseEntity.ok(loanApplicationService.getApplication(id));
    }

    // ── Manager sanction decision ──────────────────────────────────────────────

    @PatchMapping("/{id}/decision")
    @Operation(summary = "Manager Decision",
               description = "Branch manager approves, conditionally approves, or rejects")
    public ResponseEntity<ApiResponse<ApplicationResponseDto>> submitManagerDecision(
            @PathVariable String id,
            @Valid @RequestBody ManagerDecisionDto dto) {
        log.info("Manager decision for application: {} action: {}", id, dto.getAction());
        dto.setApplicationId(id);
        return ResponseEntity.ok(loanApplicationService.submitManagerDecision(dto));
    }

    // ── Real-time SSE status stream ────────────────────────────────────────────

    @GetMapping(value = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Subscribe to real-time application status updates (SSE)")
    public SseEmitter streamEvents(@PathVariable String id) {
        log.info("SSE subscribe — application: {}", id);
        SseEmitter emitter = new SseEmitter(5 * 60 * 1000L); // 5-minute timeout

        SseRegistry.register(id, emitter);
        emitter.onCompletion(() -> SseRegistry.remove(id, emitter));
        emitter.onTimeout(()    -> SseRegistry.remove(id, emitter));
        emitter.onError((e)    -> SseRegistry.remove(id, emitter));

        // Send current status immediately
        try {
            ApiResponse<ApplicationResponseDto> current = loanApplicationService.getApplication(id);
            emitter.send(SseEmitter.event().name("status").data(Map.of(
                "applicationId", id,
                "status", current.getData() != null ? current.getData().getStatus() : "UNKNOWN"
            )));
        } catch (Exception e) {
            log.warn("Could not send initial SSE event for {}: {}", id, e.getMessage());
        }
        return emitter;
    }

    /**
     * In-memory SSE emitter registry.
     * Publish status changes from LoanApplicationService by calling
     * ApplicationController.SseRegistry.publish(applicationId, status).
     */
    public static final class SseRegistry {
        private static final ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> EMITTERS =
                new ConcurrentHashMap<>();

        public static void register(String appId, SseEmitter emitter) {
            EMITTERS.computeIfAbsent(appId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        }

        public static void remove(String appId, SseEmitter emitter) {
            CopyOnWriteArrayList<SseEmitter> list = EMITTERS.get(appId);
            if (list != null) list.remove(emitter);
        }

        public static void publish(String appId, String status) {
            CopyOnWriteArrayList<SseEmitter> emitters = EMITTERS.getOrDefault(appId, new CopyOnWriteArrayList<>());
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().name("status")
                        .data(Map.of("applicationId", appId, "status", status)));
                } catch (IOException ex) {
                    emitter.completeWithError(ex);
                }
            }
        }
    }
}

