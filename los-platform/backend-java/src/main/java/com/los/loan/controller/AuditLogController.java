package com.los.loan.controller;

import com.los.loan.entity.AuditLog;
import com.los.loan.service.AuditLogService;
import com.los.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
@Tag(name = "Audit Logs", description = "System audit trail endpoints")
public class AuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping
    @Operation(summary = "Get Audit Logs", description = "Get audit logs for a specific application")
    public ResponseEntity<ApiResponse<List<AuditLog>>> getLogs(
            @RequestParam String applicationId) {
        log.info("GET /api/audit-logs for application: {}", applicationId);
        return ResponseEntity.ok(auditLogService.getLogsByApplication(applicationId));
    }
}
