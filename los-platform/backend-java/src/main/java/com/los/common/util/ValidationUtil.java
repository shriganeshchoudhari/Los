package com.los.common.util;

import com.los.common.exception.LosException;

/**
 * Validation utility for business logic validation.
 */
public class ValidationUtil {

    /**
     * Validate that a value is not null
     */
    public static void requireNonNull(Object value, String errorCode, String message) {
        if (value == null) {
            throw new LosException(errorCode, message, 400, false);
        }
    }

    /**
     * Validate that a string is not blank
     */
    public static void requireNonBlank(String value, String errorCode, String message) {
        if (StringUtil.isBlank(value)) {
            throw new LosException(errorCode, message, 400, false);
        }
    }

    /**
     * Validate a mobile number format
     */
    public static void validateMobileNumber(String mobile, String errorCode) {
        if (!StringUtil.isValidIndianMobile(mobile)) {
            throw new LosException(errorCode, "Invalid mobile number format", 400, false);
        }
    }

    /**
     * Validate an email format
     */
    public static void validateEmail(String email, String errorCode) {
        if (!StringUtil.isValidEmail(email)) {
            throw new LosException(errorCode, "Invalid email format", 400, false);
        }
    }

    /**
     * Validate that a condition is true
     */
    public static void assertTrue(boolean condition, String errorCode, String message) {
        if (!condition) {
            throw new LosException(errorCode, message, 400, false);
        }
    }

    /**
     * Validate that a condition is false
     */
    public static void assertFalse(boolean condition, String errorCode, String message) {
        if (condition) {
            throw new LosException(errorCode, message, 400, false);
        }
    }

    /**
     * Validate that two values are equal
     */
    public static void assertEquals(Object expected, Object actual, String errorCode, String message) {
        if (!expected.equals(actual)) {
            throw new LosException(errorCode, message, 400, false);
        }
    }
}
