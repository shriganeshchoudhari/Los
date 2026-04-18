package com.los.integration.repository;

import com.los.integration.entity.BureauScore;
import com.los.integration.entity.BureauPullStatus;
import com.los.integration.entity.BureauProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BureauScoreRepository extends JpaRepository<BureauScore, String> {

    Optional<BureauScore> findByApplicationIdAndProvider(String applicationId, BureauProvider provider);

    List<BureauScore> findByApplicationId(String applicationId);

    List<BureauScore> findByStatus(BureauPullStatus status);

    @Query("SELECT b FROM BureauScore b WHERE b.status = :status ORDER BY b.pullTimestamp DESC")
    List<BureauScore> findByStatusOrderByPullTimestamp(
            @Param("status") BureauPullStatus status
    );

    List<BureauScore> findByApplicantId(String applicantId);

    Optional<BureauScore> findByReportId(String reportId);
}
