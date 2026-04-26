package com.los.loan.repository;

import com.los.loan.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, String> {
    List<AuditLog> findByApplicationIdOrderByPerformedAtDesc(String applicationId);
    List<AuditLog> findByPerformedByOrderByPerformedAtDesc(String performedBy);
}
