package com.los.decision.repository;

import com.los.decision.entity.DecisionRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DecisionRuleRepository extends JpaRepository<DecisionRule, String> {

    Optional<DecisionRule> findByRuleCode(String ruleCode);

    List<DecisionRule> findByIsActiveTrue();

    List<DecisionRule> findByProductType(String productType);

    @Query("SELECT r FROM DecisionRule r WHERE r.isActive = true AND r.productType = :productType ORDER BY r.priority ASC")
    List<DecisionRule> findActiveRulesByProductType(@Param("productType") String productType);

    List<DecisionRule> findByRuleNameContainingIgnoreCase(String name);

    @Query("SELECT r FROM DecisionRule r WHERE r.isActive = true ORDER BY r.priority ASC")
    List<DecisionRule> findAllActiveOrderByPriority();
}
