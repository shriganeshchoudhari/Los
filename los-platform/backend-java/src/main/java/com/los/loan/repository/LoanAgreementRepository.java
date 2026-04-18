package com.los.loan.repository;

import com.los.loan.entity.LoanAgreement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoanAgreementRepository extends JpaRepository<LoanAgreement, String> {

    @Query("SELECT la FROM LoanAgreement la WHERE la.applicationId = :applicationId")
    Optional<LoanAgreement> findByApplicationId(@Param("applicationId") String applicationId);

    @Query("SELECT la FROM LoanAgreement la WHERE la.agreementNumber = :agreementNumber")
    Optional<LoanAgreement> findByAgreementNumber(@Param("agreementNumber") String agreementNumber);

    @Query("SELECT la FROM LoanAgreement la WHERE la.status = :status")
    List<LoanAgreement> findByStatus(@Param("status") String status);

    @Query("SELECT la FROM LoanAgreement la WHERE la.esignStatus = :esignStatus")
    List<LoanAgreement> findByEsignStatus(@Param("esignStatus") String esignStatus);
}
