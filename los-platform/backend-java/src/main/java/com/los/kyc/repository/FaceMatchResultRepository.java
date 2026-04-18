package com.los.kyc.repository;

import com.los.kyc.entity.FaceMatchResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FaceMatchResultRepository extends JpaRepository<FaceMatchResult, UUID> {
    Optional<FaceMatchResult> findTopByKycIdOrderByCreatedAtDesc(String kycId);
}
