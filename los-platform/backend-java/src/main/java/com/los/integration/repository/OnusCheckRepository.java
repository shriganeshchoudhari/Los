package com.los.integration.repository;

import com.los.integration.entity.OnusCheck;
import com.los.integration.entity.OnusCheckStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OnusCheckRepository extends JpaRepository<OnusCheck, String> {

    Optional<OnusCheck> findByApplicationId(String applicationId);

    List<OnusCheck> findByStatus(OnusCheckStatus status);

    Optional<OnusCheck> findByApplicantIdAndPan(String applicantId, String pan);

    @Query("SELECT o FROM OnusCheck o WHERE o.status = :status AND o.riskLevel = :riskLevel")
    List<OnusCheck> findByStatusAndRiskLevel(
            @Param("status") OnusCheckStatus status,
            @Param("riskLevel") String riskLevel
    );

    List<OnusCheck> findByApplicationIdAndApplicantId(String applicationId, String applicantId);
}
