package com.los.kyc.repository;

import com.los.kyc.entity.PanVerificationResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PanVerificationResultRepository extends JpaRepository<PanVerificationResult, UUID> {
    Optional<PanVerificationResult> findByKycId(String kycId);
}
