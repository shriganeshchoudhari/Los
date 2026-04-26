package com.los.loan.service;

import com.los.loan.entity.AuditLog;
import com.los.loan.repository.AuditLogRepository;
import com.los.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public ApiResponse<List<AuditLog>> getLogsByApplication(String applicationId) {
        log.info("Fetching audit logs for application: {}", applicationId);
        List<AuditLog> logs = auditLogRepository.findByApplicationIdOrderByPerformedAtDesc(applicationId);
        return ApiResponse.success(logs, "Audit logs retrieved successfully");
    }

    @Transactional
    public void logAction(String applicationId, String performedBy, String action, String module, String remarks) {
        AuditLog logEntry = AuditLog.builder()
                .applicationId(applicationId)
                .performedBy(performedBy)
                .performedAt(LocalDateTime.now())
                .action(action)
                .module(module)
                .remarks(remarks)
                .build();
        auditLogRepository.save(logEntry);
    }
}
