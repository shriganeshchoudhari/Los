package com.los.integration.repository;

import com.los.integration.entity.DisbursementRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DisbursementRecordRepository extends JpaRepository<DisbursementRecord, String> {

    List<DisbursementRecord> findByLoanId(String loanId);

    List<DisbursementRecord> findByApplicationId(String applicationId);

    Optional<DisbursementRecord> findByTransactionId(String transactionId);

    @Query("SELECT d FROM DisbursementRecord d WHERE d.status = :status")
    List<DisbursementRecord> findByStatus(@Param("status") String status);

    @Query("SELECT d FROM DisbursementRecord d WHERE d.loanId = :loanId ORDER BY d.trancheNumber ASC")
    List<DisbursementRecord> findByLoanIdOrderByTranche(@Param("loanId") String loanId);

    List<DisbursementRecord> findByReferenceNumber(String referenceNumber);
}
