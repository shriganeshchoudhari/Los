package com.los.kyc.repository;

import com.los.kyc.entity.ConsentRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConsentRecordRepository extends JpaRepository<ConsentRecord, UUID> {
    List<ConsentRecord> findByApplicationIdOrderByCreatedAtDesc(String applicationId);
}
