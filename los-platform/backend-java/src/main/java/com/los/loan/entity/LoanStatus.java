package com.los.loan.entity;

/**
 * Standardized statuses for the Loan Application lifecycle.
 * Aligned with frontend types and backend state machine requirements.
 */
public enum LoanStatus {
    /** Initial state when application is being filled */
    DRAFT,
    
    /** Submitted by the applicant, awaiting processing */
    SUBMITTED,

    /** KYC process initiated */
    KYC_IN_PROGRESS,

    /** KYC verified successfully */
    KYC_COMPLETE,

    /** KYC process failed */
    KYC_FAILED,

    /** Awaiting document uploads from customer */
    DOCUMENT_COLLECTION,
    
    /** Under review by a loan officer or credit analyst */
    UNDER_REVIEW,

    /** Under system or manual processing */
    UNDER_PROCESSING,

    /** Credit bureau report is being fetched */
    BUREAU_PULL_IN_PROGRESS,

    /** Detailed credit assessment in progress */
    CREDIT_ASSESSMENT,

    /** Awaiting field investigation report */
    PENDING_FIELD_INVESTIGATION,

    /** Awaiting legal or technical evaluation */
    PENDING_LEGAL_TECHNICAL,

    /** Pending approval from Credit Committee */
    CREDIT_COMMITTEE,

    /** Application approved but not yet sanctioned */
    APPROVED,

    /** Approved with specific conditions */
    CONDITIONALLY_APPROVED,
    
    /** Sanction letter issued and approved */
    SANCTIONED,

    /** Disbursement process has started */
    DISBURSEMENT_IN_PROGRESS,
    
    /** Application rejected during review or by rule engine */
    REJECTED,
    
    /** Loan amount has been disbursed to the customer */
    DISBURSED,
    
    /** Loan is fully repaid and closed */
    CLOSED,

    /** Application withdrawn by customer */
    WITHDRAWN,

    /** Application cancelled by bank */
    CANCELLED,

    /** Application in cancellation window (grace period) */
    CANCELLATION_WINDOW
}
