package com.los.kyc.repository;

import com.los.kyc.entity.KycRiskAssessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KycRiskAssessmentRepository extends JpaRepository<KycRiskAssessment, String> {

    @Query("SELECT k FROM KycRiskAssessment k WHERE k.kycRecordId = :kycRecordId ORDER BY k.assessmentDate DESC")
    List<KycRiskAssessment> findByKycRecordId(@Param("kycRecordId") String kycRecordId);

    @Query("SELECT k FROM KycRiskAssessment k WHERE k.kycRecordId = :kycRecordId ORDER BY k.assessmentDate DESC LIMIT 1")
    Optional<KycRiskAssessment> findLatestByKycRecordId(@Param("kycRecordId") String kycRecordId);

    @Query("SELECT k FROM KycRiskAssessment k WHERE k.riskLevel = :riskLevel")
    List<KycRiskAssessment> findByRiskLevel(@Param("riskLevel") String riskLevel);
}
