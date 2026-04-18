package com.los.common.util;

import lombok.extern.slf4j.Slf4j;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Cryptographic utility for secure hashing operations.
 */
@Slf4j
public class CryptoUtil {

    /**
     * Hash a value using SHA-256
     */
    public static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(input.getBytes());
            StringBuilder hexString = new StringBuilder();
            for (byte hashByte : hashBytes) {
                String hex = Integer.toHexString(0xff & hashByte);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256 algorithm not available", e);
            throw new RuntimeException("Hashing failed", e);
        }
    }

    /**
     * Verify a SHA-256 hash
     */
    public static boolean verifySha256(String input, String hash) {
        return sha256(input).equals(hash);
    }

    /**
     * Hash a mobile number with salt for security
     */
    public static String hashMobile(String mobile) {
        // Use mobile + fixed salt
        return sha256(mobile + "los_mobile_salt_2024");
    }

    /**
     * Hash OTP value
     */
    public static String hashOtp(String otp) {
        return sha256(otp + "los_otp_salt_2024");
    }
}
