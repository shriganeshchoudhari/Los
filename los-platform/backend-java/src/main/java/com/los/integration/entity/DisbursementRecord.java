package com.los.integration.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;

@EqualsAndHashCode(callSuper = false)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "disbursement_records", schema = "integration")
public class DisbursementRecord extends BaseEntity {

    @Column(name = "loan_id", nullable = false)
    private String loanId;

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "tranche_number")
    private Integer trancheNumber;

    @Column(name = "amount")
    private BigDecimal amount;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "disbursement_mode", length = 50)
    private String disbursementMode;

    @Column(name = "bank_name", length = 200)
    private String bankName;

    @Column(name = "account_number", length = 50)
    private String accountNumber;

    @Column(name = "ifsc_code", length = 20)
    private String ifscCode;

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;

    @Column(name = "transaction_id", unique = true, length = 100)
    private String transactionId;

    @Column(name = "scheduled_date")
    private String scheduledDate;

    @Column(name = "actual_date")
    private String actualDate;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "response_data", columnDefinition = "jsonb")
    private String responseData;
}
