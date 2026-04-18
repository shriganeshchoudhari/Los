package com.los.decision.repository;

import com.los.decision.entity.Decision;
import com.los.decision.entity.DecisionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DecisionRepository extends JpaRepository<Decision, String> {

    Optional<Decision> findByApplicationId(String applicationId);

    List<Decision> findByStatus(DecisionStatus status);

    @Query("SELECT d FROM Decision d WHERE d.status = :status AND d.decidedAt BETWEEN :startDate AND :endDate")
    List<Decision> findByStatusAndDateRange(
            @Param("status") DecisionStatus status,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate
    );

    @Query("SELECT COUNT(d) FROM Decision d WHERE d.status = :status")
    Long countByStatus(@Param("status") DecisionStatus status);

    @Query("SELECT d FROM Decision d WHERE d.decidedBy = :userId ORDER BY d.decidedAt DESC")
    List<Decision> findByDecidedBy(@Param("userId") String userId);

    List<Decision> findByFinalDecision(String finalDecision);
}
