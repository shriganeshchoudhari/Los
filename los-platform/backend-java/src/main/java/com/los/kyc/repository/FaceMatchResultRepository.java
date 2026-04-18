package com.los.kyc.repository;

import com.los.kyc.entity.FaceMatchResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FaceMatchResultRepository extends JpaRepository<FaceMatchResult, String> {
    Optional<FaceMatchResult> findTopByKycIdOrderByCreatedAtDesc(String kycId);
}
