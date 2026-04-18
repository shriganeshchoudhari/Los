package com.los.dsa.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.EqualsAndHashCode;

@EqualsAndHashCode(callSuper = false)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "partner_activities", schema = "dsa")
public class DealActivity extends BaseEntity {

    @Column(name = "partner_id", nullable = false)
    private String partnerId;

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "activity_type", length = 50)
    private String activityType;

    @Column(name = "loan_amount")
    private Long loanAmount;

    @Column(name = "activity_status", length = 50)
    private String activityStatus;

    @Column(name = "created_by_user_id", nullable = false)
    private String createdByUserId;

    @Column(name = "activity_date")
    private String activityDate;

    @Column(name = "remarks", length = 1000)
    private String remarks;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;
}
