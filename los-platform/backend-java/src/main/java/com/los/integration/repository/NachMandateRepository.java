package com.los.integration.repository;

import com.los.integration.entity.NachMandate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NachMandateRepository extends JpaRepository<NachMandate, String> {

    Optional<NachMandate> findByApplicationId(String applicationId);

    Optional<NachMandate> findByMandateId(String mandateId);

    List<NachMandate> findByLoanId(String loanId);

    @Query("SELECT n FROM NachMandate n WHERE n.status = :status")
    List<NachMandate> findByStatus(@Param("status") String status);

    Optional<NachMandate> findByApplicationIdAndLoanId(String applicationId, String loanId);

    List<NachMandate> findByAccountNumber(String accountNumber);
}
