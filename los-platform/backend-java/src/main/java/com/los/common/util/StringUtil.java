package com.los.common.util;

/**
 * String utility functions for common operations.
 */
public class StringUtil {

    /**
     * Mask a mobile number for display (show last 4 digits)
     */
    public static String maskMobile(String mobile) {
        if (mobile == null || mobile.length() < 4) {
            return "XXXXXXXXXX";
        }
        return "XXXXXX" + mobile.substring(mobile.length() - 4);
    }

    /**
     * Mask email address (show first 2 chars and domain)
     */
    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return "***@***.*";
        }
        String[] parts = email.split("@");
        String localPart = parts[0];
        String domain = parts[1];
        
        String maskedLocal = localPart.length() > 2 
            ? localPart.substring(0, 2) + "*".repeat(localPart.length() - 2)
            : localPart;
        return maskedLocal + "@" + domain;
    }

    /**
     * Check if string is blank (null or empty)
     */
    public static boolean isBlank(String str) {
        return str == null || str.trim().isEmpty();
    }

    /**
     * Check if string is not blank
     */
    public static boolean isNotBlank(String str) {
        return !isBlank(str);
    }

    /**
     * Validate Indian mobile number format (10 digits, starts with 6-9)
     */
    public static boolean isValidIndianMobile(String mobile) {
        return mobile != null && mobile.matches("^[6-9]\\d{9}$");
    }

    /**
     * Validate email format
     */
    public static boolean isValidEmail(String email) {
        return email != null && email.matches("^[A-Za-z0-9+_.-]+@([A-Za-z0-9.-]+\\.[A-Za-z]{2,})$");
    }
}
