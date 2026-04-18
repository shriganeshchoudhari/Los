package com.los.kyc.repository;

import com.los.kyc.entity.AadhaarKycResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface AadhaarKycResultRepository extends JpaRepository<AadhaarKycResult, String> {
    Optional<AadhaarKycResult> findByKycId(String kycId);

    @Query("SELECT a FROM AadhaarKycResult a WHERE a.aadhaarNumberHash = :hash AND a.verifiedAt > :cutoff ORDER BY a.verifiedAt DESC LIMIT 1")
    Optional<AadhaarKycResult> findValidByAadhaarHash(@Param("hash") String aadhaarNumberHash, @Param("cutoff") Instant cutoff);
}
