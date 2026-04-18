package com.los.integration.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "nach_mandates", schema = "integration")
public class NachMandate extends BaseEntity {

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "loan_id", nullable = false)
    private String loanId;

    @Column(name = "mandate_id", unique = true, length = 100)
    private String mandateId;

    @Column(name = "account_number", length = 50)
    private String accountNumber;

    @Column(name = "ifsc_code", length = 20)
    private String ifscCode;

    @Column(name = "bank_name", length = 200)
    private String bankName;

    @Column(name = "account_holder_name", length = 200)
    private String accountHolderName;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "mandate_amount")
    private Long mandateAmount;

    @Column(name = "start_date")
    private String startDate;

    @Column(name = "end_date")
    private String endDate;

    @Column(name = "response_data", columnDefinition = "jsonb")
    private String responseData;

    @Column(name = "error_message", length = 500)
    private String errorMessage;
}
