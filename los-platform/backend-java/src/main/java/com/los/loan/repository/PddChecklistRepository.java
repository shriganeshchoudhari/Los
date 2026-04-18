package com.los.loan.repository;

import com.los.loan.entity.PddChecklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PddChecklistRepository extends JpaRepository<PddChecklist, String> {

    @Query("SELECT p FROM PddChecklist p WHERE p.applicationId = :applicationId ORDER BY p.itemCode")
    List<PddChecklist> findByApplicationId(@Param("applicationId") String applicationId);

    @Query("SELECT p FROM PddChecklist p WHERE p.applicationId = :applicationId AND p.itemCode = :itemCode")
    Optional<PddChecklist> findByApplicationIdAndItemCode(@Param("applicationId") String applicationId, @Param("itemCode") String itemCode);

    @Query("SELECT COUNT(*) FROM PddChecklist p WHERE p.applicationId = :applicationId AND p.isCompleted = true")
    int countCompletedItems(@Param("applicationId") String applicationId);

    @Query("SELECT COUNT(*) FROM PddChecklist p WHERE p.applicationId = :applicationId")
    int countTotalItems(@Param("applicationId") String applicationId);

    @Query("SELECT COUNT(*) FROM PddChecklist p WHERE p.applicationId = :applicationId AND p.isWaived = true")
    int countWaivedItems(@Param("applicationId") String applicationId);
}
