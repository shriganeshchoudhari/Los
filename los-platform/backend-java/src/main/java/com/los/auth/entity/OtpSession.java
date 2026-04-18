package com.los.auth.entity;

import com.los.common.entity.BaseEntity;
import com.los.common.enums.OtpPurpose;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "otp_sessions", schema = "auth", indexes = {
    @Index(name = "idx_otp_sessions_mobile_hash", columnList = "mobile_hash"),
    @Index(name = "idx_otp_sessions_session_id", columnList = "session_id"),
    @Index(name = "idx_otp_sessions_status", columnList = "status")
})
public class OtpSession extends BaseEntity {

    @Column(name = "mobile", nullable = false, length = 20)
    private String mobile;

    @Column(name = "mobile_hash", nullable = false, length = 255)
    private String mobileHash;

    @Column(name = "session_id", nullable = false, unique = true, length = 255)
    private String sessionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", nullable = false, length = 50)
    private OtpPurpose purpose;

    @Column(name = "otp_hash", length = 255)
    private String otpHash;

    @Column(name = "channel", length = 50)
    private String channel; // SMS, WHATSAPP, EMAIL

    @Column(name = "attempt_count", nullable = false)
    private Integer attemptCount = 0;

    @Column(name = "max_attempts", nullable = false)
    private Integer maxAttempts = 3;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "status", nullable = false, length = 50)
    private String status = "PENDING"; // PENDING, VERIFIED, EXPIRED, FAILED

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "device_fingerprint", length = 255)
    private String deviceFingerprint;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;
}
