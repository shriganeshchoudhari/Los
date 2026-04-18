package com.los.loan.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "loan_agreements", schema = "loan", indexes = {
    @Index(name = "idx_loan_agreements_application_id", columnList = "application_id")
})
public class LoanAgreement extends BaseEntity {

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "agreement_number", nullable = false, unique = true, length = 50)
    private String agreementNumber;

    @Column(name = "principal_amount", nullable = false)
    private BigDecimal principalAmount;

    @Column(name = "interest_rate_bps", nullable = false)
    private Integer interestRateBps; // In basis points

    @Column(name = "tenure_months", nullable = false)
    private Integer tenureMonths;

    @Column(name = "emi_amount")
    private BigDecimal emiAmount;

    @Column(name = "disbursement_date")
    private LocalDate disbursementDate;

    @Column(name = "maturity_date")
    private LocalDate maturityDate;

    @Column(name = "status", length = 50)
    private String status; // ACTIVE, CLOSED, DEFAULT, RESCHEDULED

    @Column(name = "document_url", length = 500)
    private String documentUrl;

    @Column(name = "esign_status", length = 50)
    private String esignStatus; // PENDING, SIGNED, REJECTED

    @Column(name = "esign_date")
    private LocalDate esignDate;

    @Column(name = "esign_provider", length = 100)
    private String esignProvider; // NSDL, eSign Gateway, etc.

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;
}
