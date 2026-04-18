package com.los.integration.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "onus_checks", schema = "integration")
public class OnusCheck extends BaseEntity {

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "applicant_id", nullable = false)
    private String applicantId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private OnusCheckStatus status;

    @Column(name = "pan", length = 20)
    private String pan;

    @Column(name = "name", length = 200)
    private String name;

    @Column(name = "check_result", length = 50)
    private String checkResult;

    @Column(name = "match_percentage")
    private Integer matchPercentage;

    @Column(name = "risk_level", length = 50)
    private String riskLevel;

    @Column(name = "flags", columnDefinition = "jsonb")
    private String flags;

    @Column(name = "response_data", columnDefinition = "jsonb")
    private String responseData;

    @Column(name = "error_message", length = 500)
    private String errorMessage;
}
