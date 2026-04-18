package com.los.loan.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "loan_applications", schema = "loan")
public class LoanApplication extends BaseEntity {

    @Column(name = "application_number", nullable = false, unique = true, length = 50)
    private String applicationNumber;

    @Column(name = "customer_id", nullable = false)
    private String customerId;

    @Column(name = "loan_type", nullable = false, length = 50)
    private String loanType; // PERSONAL, HOME, AUTO, etc.

    @Column(name = "requested_amount", nullable = false)
    private BigDecimal requestedAmount;

    @Column(name = "sanction_amount")
    private BigDecimal sanctionAmount;

    @Column(name = "net_disbursed_amount")
    private BigDecimal netDisbursedAmount;

    @Column(name = "tenure_months")
    private Integer tenureMonths;

    @Column(name = "status", nullable = false, length = 50)
    private String status = "DRAFT"; // DRAFT, submitted, APPROVED, DISBURSED, CLOSED, REJECTED

    @Column(name = "application_date", nullable = false)
    private LocalDate applicationDate;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "disbursed_at")
    private LocalDateTime disbursedAt;

    @Column(name = "rejected_at")
    private LocalDateTime rejectedAt;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "employment_type", length = 50)
    private String employmentType; // SALARIED, SELF_EMPLOYED, BUSINESS

    @Column(name = "annual_income")
    private BigDecimal annualIncome;

    @Column(name = "credit_score")
    private Integer creditScore;

    @Column(name = "assigned_to_user_id", length = 50)
    private String assignedToUserId;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;
}
