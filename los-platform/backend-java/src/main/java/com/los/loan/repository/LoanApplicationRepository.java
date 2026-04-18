package com.los.loan.repository;

import com.los.loan.entity.LoanApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoanApplicationRepository extends JpaRepository<LoanApplication, String> {

    @Query("SELECT l FROM LoanApplication l WHERE l.applicationNumber = :applicationNumber AND l.isDeleted = false")
    Optional<LoanApplication> findByApplicationNumber(@Param("applicationNumber") String applicationNumber);

    @Query("SELECT l FROM LoanApplication l WHERE l.customerId = :customerId AND l.isDeleted = false ORDER BY l.createdAt DESC")
    List<LoanApplication> findByCustomerId(@Param("customerId") String customerId);

    @Query("SELECT l FROM LoanApplication l WHERE l.status = :status AND l.isDeleted = false")
    List<LoanApplication> findByStatus(@Param("status") String status);

    @Query("SELECT l FROM LoanApplication l WHERE l.assignedToUserId = :userId AND l.isDeleted = false")
    List<LoanApplication> findByAssignedToUserId(@Param("userId") String userId);

    @Query("SELECT COUNT(*) FROM LoanApplication l WHERE l.customerId = :customerId AND l.isDeleted = false")
    long countByCustomerId(@Param("customerId") String customerId);
}
