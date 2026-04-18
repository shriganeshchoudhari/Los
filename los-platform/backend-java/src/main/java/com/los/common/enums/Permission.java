package com.los.common.enums;

/**
 * Permission enumeration for RBAC (Role-Based Access Control).
 * Defines granular permissions for different operations in the system.
 */
public enum Permission {
    // Application permissions
    APPLICATION_CREATE("application:create"),
    APPLICATION_READ("application:read"),
    APPLICATION_UPDATE("application:update"),
    APPLICATION_DELETE("application:delete"),
    APPLICATION_SUBMIT("application:submit"),
    APPLICATION_ASSIGN_OFFICER("application:assign_officer"),
    APPLICATION_READ_ALL("application:read_all"),

    // KYC permissions
    KYC_INITIATE("kyc:initiate"),
    KYC_VERIFY("kyc:verify"),
    KYC_READ("kyc:read"),

    // Document permissions
    DOCUMENT_UPLOAD("document:upload"),
    DOCUMENT_READ("document:read"),
    DOCUMENT_DELETE("document:delete"),
    DOCUMENT_REVIEW("document:review"),
    DOCUMENT_WATERMARK("document:watermark"),

    // Decision permissions
    DECISION_TRIGGER("decision:trigger"),
    DECISION_READ("decision:read"),
    DECISION_OVERRIDE_REQUEST("decision:override_request"),
    DECISION_OVERRIDE_APPROVE("decision:override_approve"),

    // Bureau permissions
    BUREAU_PULL("bureau:pull"),
    BUREAU_READ("bureau:read"),

    // Disbursement permissions
    DISBURSEMENT_INITIATE("disbursement:initiate"),
    DISBURSEMENT_READ("disbursement:read"),
    DISBURSEMENT_APPROVE("disbursement:approve"),

    // Loan agreement & sanction letter permissions
    SANCTION_LETTER_VIEW("sanction_letter:view"),
    SANCTION_LETTER_GENERATE("sanction_letter:generate"),
    LOAN_AGREEMENT_VIEW("loan_agreement:view"),
    LOAN_AGREEMENT_GENERATE("loan_agreement:generate"),
    LOAN_AGREEMENT_SIGN("loan_agreement:sign"),

    // Policy permissions
    POLICY_VIEW("policy:view"),
    POLICY_MANAGE("policy:manage"),
    POLICY_COMPARE("policy:compare"),

    // User management permissions
    USER_MANAGE("user:manage"),
    USER_READ("user:read"),
    USER_CREATE("user:create"),

    // Partner permissions
    PARTNER_APPROVE("partner:approve"),
    PARTNER_READ("partner:read"),
    PARTNER_MANAGE("partner:manage"),

    // Commission permissions
    COMMISSION_VIEW("commission:view");

    private final String value;

    Permission(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
