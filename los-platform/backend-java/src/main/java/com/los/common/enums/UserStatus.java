package com.los.common.enums;

/**
 * User status enum to track the state of user accounts.
 */
public enum UserStatus {
    ACTIVE("User account is active"),
    INACTIVE("User account is inactive"),
    SUSPENDED("User account is suspended"),
    LOCKED("User account is locked due to security reasons"),
    PENDING_VERIFICATION("User account pending email/phone verification"),
    DEACTIVATED("User account has been deactivated");

    private final String description;

    UserStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
