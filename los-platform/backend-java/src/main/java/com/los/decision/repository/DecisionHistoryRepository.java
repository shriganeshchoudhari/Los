package com.los.decision.repository;

import com.los.decision.entity.DecisionHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DecisionHistoryRepository extends JpaRepository<DecisionHistory, String> {

    List<DecisionHistory> findByDecisionId(String decisionId);

    List<DecisionHistory> findByApplicationId(String applicationId);

    @Query("SELECT h FROM DecisionHistory h WHERE h.decisionId = :decisionId ORDER BY h.createdAt DESC")
    List<DecisionHistory> findByDecisionIdOrderByCreatedAtDesc(@Param("decisionId") String decisionId);

    @Query("SELECT h FROM DecisionHistory h WHERE h.applicationId = :applicationId ORDER BY h.createdAt DESC")
    List<DecisionHistory> findByApplicationIdOrderByCreatedAtDesc(@Param("applicationId") String applicationId);

    List<DecisionHistory> findByChangedBy(String changedBy);
}
