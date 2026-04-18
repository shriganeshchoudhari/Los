package com.los.integration.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

@EqualsAndHashCode(callSuper = false)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "bureau_scores", schema = "integration")
public class BureauScore extends BaseEntity {

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "applicant_id", nullable = false)
    private String applicantId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false)
    private BureauProvider provider;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private BureauPullStatus status;

    @Column(name = "credit_score")
    private Integer creditScore;

    @Column(name = "pan_hash", length = 64)
    private String panHash;

    @Column(name = "report_id", length = 100)
    private String reportId;

    @Column(name = "consent_timestamp")
    private LocalDateTime consentTimestamp;

    @Column(name = "pull_timestamp")
    private LocalDateTime pullTimestamp;

    @Column(name = "raw_response", columnDefinition = "jsonb")
    private String rawResponse;

    @Column(name = "parsed_response", columnDefinition = "jsonb")
    private String parsedResponse;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "retry_count")
    private Integer retryCount = 0;

    @Column(name = "next_retry_at")
    private LocalDateTime nextRetryAt;
}
