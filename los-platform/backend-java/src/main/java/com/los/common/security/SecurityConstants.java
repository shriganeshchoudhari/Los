package com.los.common.security;

/**
 * Constants used for security, headers, and auditing across the LOS platform.
 */
public final class SecurityConstants {

    private SecurityConstants() {
        // Prevent instantiation
    }

    // Standard User Identifiers
    public static final String SYSTEM_USER = "SYSTEM_USER";
    public static final String ADMIN_USER = "ADMIN_USER";

    // Custom Header Names
    public static final String HEADER_DEVICE_FINGERPRINT = "X-Device-Fingerprint";
    public static final String HEADER_CORRELATION_ID = "X-Correlation-Id";
    public static final String HEADER_REQUEST_ID = "X-Request-Id";

    // Auth Related
    public static final String BEARER_PREFIX = "Bearer ";
    public static final String COOKIE_ACCESS_TOKEN = "access_token";
    public static final String COOKIE_REFRESH_TOKEN = "refresh_token";
}
