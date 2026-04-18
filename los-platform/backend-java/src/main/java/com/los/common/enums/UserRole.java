package com.los.common.enums;

/**
 * User roles in the LOS Platform system.
 * Defines authorization levels for different user types.
 */
public enum UserRole {
    APPLICANT("Loan Applicant"),
    LOAN_OFFICER("Loan Officer"),
    CREDIT_ANALYST("Credit Analyst"),
    BRANCH_MANAGER("Branch Manager"),
    ZONAL_CREDIT_HEAD("Zonal Credit Head"),
    COMPLIANCE_OFFICER("Compliance Officer"),
    SYSTEM("System Account"),
    ADMIN("Administrator");

    private final String description;

    UserRole(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
