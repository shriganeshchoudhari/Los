package com.los.kyc.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "consent_records", schema = "kyc")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsentRecord extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "application_id", nullable = false, length = 50)
    private String applicationId;

    @Column(name = "consent_type", nullable = false, length = 30)
    private String consentType;

    @Column(name = "consent_text", columnDefinition = "text", nullable = false)
    private String consentText;

    @Column(name = "consent_version", length = 10)
    @Builder.Default
    private String consentVersion = "v1.0";

    @Column(name = "is_granted", nullable = false)
    @Builder.Default
    private Boolean isGranted = true;

    @Column(name = "granted_at", columnDefinition = "timestamptz", nullable = false)
    private Instant grantedAt;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "text")
    private String userAgent;
}
