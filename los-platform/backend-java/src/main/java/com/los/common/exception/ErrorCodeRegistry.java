package com.los.common.exception;

import java.util.HashMap;
import java.util.Map;

/**
 * Registry of error codes with HTTP status and retryability information.
 */
public class ErrorCodeRegistry {

    private static final Map<String, ErrorCodeConfig> REGISTRY = new HashMap<>();

    static {
        // Auth errors
        registerError("AUTH_001", 401, false);          // Invalid credentials
        registerError("AUTH_002", 401, false);          // User not found
        registerError("AUTH_003", 429, false);          // OTP attempts exceeded
        registerError("AUTH_004", 401, false);          // OTP expired
        registerError("AUTH_005", 401, false);          // Invalid OTP
        registerError("AUTH_006", 403, false);          // Insufficient permissions

        // Application errors
        registerError("APP_001", 404, false);           // Application not found
        registerError("APP_002", 409, false);           // Application already exists
        registerError("APP_003", 409, false);           // Invalid application status
        registerError("APP_004", 400, false);           // Invalid application data
        registerError("APP_005", 409, false);           // Application already submitted

        // KYC errors
        registerError("KYC_001", 400, true, 60);        // KYC initiation failed (retryable)
        registerError("KYC_002", 400, false);           // Aadhaar verification failed
        registerError("KYC_003", 503, true, 30);        // External KYC service unavailable
        registerError("KYC_004", 400, false);           // PAN verification failed
        registerError("KYC_005", 400, false);           // Face match failed
        registerError("KYC_006", 400, false);           // Invalid KYC data
        registerError("KYC_007", 400, false);           // KYC already completed

        // Bureau errors
        registerError("BUR_001", 504, true, 60);        // Bureau service timeout (retryable)
        registerError("BUR_002", 404, false);           // Bureau record not found
        registerError("BUR_003", 400, false);           // Invalid bureau request
        registerError("BUR_004", 409, false);           // Bureau already pulled

        // Decision errors
        registerError("DEC_001", 400, false);           // Invalid decision input
        registerError("DEC_002", 409, false);           // Decision already made
        registerError("DEC_003", 400, false);           // Decision rule failed

        // CBS errors
        registerError("CBS_001", 504, true, 30);        // CBS service unavailable (retryable)
        registerError("CBS_002", 409, false);           // CBS account already exists
        registerError("CBS_003", 400, false);           // Invalid CBS data
        registerError("CBS_004", 500, true, 60);        // CBS internal error (retryable)

        // Payment errors
        registerError("PAY_001", 400, false);           // Invalid payment data
        registerError("PAY_002", 403, false);           // Payment authorization failed
        registerError("PAY_003", 409, false);           // Payment already processed
        registerError("PAY_004", 502, true, 60);        // Payment gateway error (retryable)
        registerError("PAY_005", 400, true, 30);        // Payment processing error (retryable)

        // Document errors
        registerError("DOC_001", 400, false);           // Invalid document
        registerError("DOC_002", 400, false);           // Document upload failed
        registerError("DOC_003", 400, false);           // OCR failed
        registerError("DOC_004", 500, true, 30);        // Document service error (retryable)

        // General errors
        registerError("GEN_001", 500, false);           // Internal server error
        registerError("GEN_002", 503, true, 30);        // Service unavailable (retryable)
        registerError("GEN_003", 429, true, 60);        // Rate limit exceeded (retryable)
        registerError("GEN_004", 400, false);           // Invalid request
        registerError("GEN_005", 501, false);           // Feature not implemented
    }

    private static void registerError(String code, int httpStatus, boolean retryable) {
        registerError(code, httpStatus, retryable, null);
    }

    private static void registerError(String code, int httpStatus, boolean retryable, Integer retryAfterSeconds) {
        REGISTRY.put(code, new ErrorCodeConfig(code, httpStatus, retryable, retryAfterSeconds));
    }

    /**
     * Get error configuration by code
     */
    public static ErrorCodeConfig getErrorConfig(String code) {
        return REGISTRY.getOrDefault(code, new ErrorCodeConfig(code, 500, false, null));
    }

    /**
     * Check if error code exists
     */
    public static boolean contains(String code) {
        return REGISTRY.containsKey(code);
    }

    /**
     * Error code configuration
     */
    public static class ErrorCodeConfig {
        public final String code;
        public final int httpStatus;
        public final boolean retryable;
        public final Integer retryAfterSeconds;

        public ErrorCodeConfig(String code, int httpStatus, boolean retryable, Integer retryAfterSeconds) {
            this.code = code;
            this.httpStatus = httpStatus;
            this.retryable = retryable;
            this.retryAfterSeconds = retryAfterSeconds;
        }
    }
}
