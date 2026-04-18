package com.los.common.util;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Date and time utility functions.
 */
public class DateUtil {

    /**
     * Check if a DateTime has expired
     */
    public static boolean hasExpired(LocalDateTime expiryTime) {
        return LocalDateTime.now().isAfter(expiryTime);
    }

    /**
     * Get remaining seconds until expiry
     */
    public static long getRemainingSeconds(LocalDateTime expiryTime) {
        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(expiryTime)) {
            return 0;
        }
        return ChronoUnit.SECONDS.between(now, expiryTime);
    }

    /**
     * Create expiry time N seconds from now
     */
    public static LocalDateTime getExpiryTime(long secondsFromNow) {
        return LocalDateTime.now().plusSeconds(secondsFromNow);
    }

    /**
     * Create expiry time N minutes from now
     */
    public static LocalDateTime getExpiryTimeMinutes(long minutesFromNow) {
        return LocalDateTime.now().plusMinutes(minutesFromNow);
    }

    /**
     * Create expiry time N hours from now
     */
    public static LocalDateTime getExpiryTimeHours(long hoursFromNow) {
        return LocalDateTime.now().plusHours(hoursFromNow);
    }

    /**
     * Create expiry time N days from now
     */
    public static LocalDateTime getExpiryTimeDays(long daysFromNow) {
        return LocalDateTime.now().plusDays(daysFromNow);
    }
}
