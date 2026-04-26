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

    /** Awaiting document uploads from customer */
    DOCUMENT_COLLECTION,
    
    /** Under review by a loan officer or credit analyst */
    UNDER_REVIEW,
    
    /** Sanction letter issued and approved */
    SANCTIONED,
    
    /** Application rejected during review or by rule engine */
    REJECTED,
    
    /** Loan amount has been disbursed to the customer */
    DISBURSED,
    
    /** Loan is fully repaid and closed */
    CLOSED,

    /** Application withdrawn by customer */
    WITHDRAWN,

    /** Application cancelled by bank */
    CANCELLED
}
