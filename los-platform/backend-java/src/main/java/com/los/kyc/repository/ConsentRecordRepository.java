package com.los.kyc.repository;

import com.los.kyc.entity.ConsentRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConsentRecordRepository extends JpaRepository<ConsentRecord, String> {
    List<ConsentRecord> findByApplicationIdOrderByCreatedAtDesc(String applicationId);
}
