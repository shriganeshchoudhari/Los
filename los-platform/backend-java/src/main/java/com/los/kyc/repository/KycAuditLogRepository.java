package com.los.kyc.repository;

import com.los.kyc.entity.KycAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface KycAuditLogRepository extends JpaRepository<KycAuditLog, String> {

    @Query("SELECT k FROM KycAuditLog k WHERE k.kycRecordId = :kycRecordId ORDER BY k.performedAt DESC")
    List<KycAuditLog> findByKycRecordId(@Param("kycRecordId") String kycRecordId);

    @Query("SELECT k FROM KycAuditLog k WHERE k.kycRecordId = :kycRecordId AND k.action = :action ORDER BY k.performedAt DESC")
    List<KycAuditLog> findByKycRecordIdAndAction(@Param("kycRecordId") String kycRecordId, @Param("action") String action);

    @Query("SELECT k FROM KycAuditLog k WHERE k.performedAt BETWEEN :startDate AND :endDate ORDER BY k.performedAt DESC")
    List<KycAuditLog> findByDateRange(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
}
