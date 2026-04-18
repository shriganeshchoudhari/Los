package com.los.common.enums;

/**
 * OTP purpose enumeration defining reasons for OTP generation.
 */
public enum OtpPurpose {
    LOGIN("OTP for login authentication"),
    AADHAAR_CONSENT("OTP for Aadhaar KYC consent"),
    LOAN_APPLICATION_SUBMIT("OTP for loan application submission"),
    DISBURSEMENT_CONFIRM("OTP for disbursement confirmation"),
    PASSWORD_RESET("OTP for password reset");

    private final String description;

    OtpPurpose(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
