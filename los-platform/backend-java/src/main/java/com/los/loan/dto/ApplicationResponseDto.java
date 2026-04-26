package com.los.loan.dto;

import com.los.loan.entity.LoanStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApplicationResponseDto {

    // Core identifiers
    private String applicationId;
    private String applicationNumber;
    private LoanStatus status;

    // Applicant info (denormalized for list views)
    private String applicantName;
    private String customerId;

    // Loan details
    private String loanType;
    private BigDecimal requestedAmount;
    private BigDecimal sanctionAmount;
    private BigDecimal netDisbursedAmount;
    private Integer tenureMonths;
    private String employmentType;
    private BigDecimal annualIncome;
    private Integer creditScore;
    private String assignedToUserId;

    // Timestamps
    private LocalDate applicationDate;
    private LocalDateTime submittedAt;
    private LocalDateTime approvedAt;
    private LocalDateTime rejectedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Decision / rejection
    private String rejectionReason;

    // General message (for action responses)
    private String message;

    // Extra metadata (flexible map for additional context)
    private Map<String, Object> data;
}

