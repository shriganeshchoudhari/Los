package com.los.kyc.repository;

import com.los.kyc.entity.KycRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KycRecordRepository extends JpaRepository<KycRecord, String> {
    Optional<KycRecord> findByApplicationId(String applicationId);
    Optional<KycRecord> findByUserIdAndStatus(String userId, KycRecord.KycStatus status);
    List<KycRecord> findByStatus(KycRecord.KycStatus status);
}
