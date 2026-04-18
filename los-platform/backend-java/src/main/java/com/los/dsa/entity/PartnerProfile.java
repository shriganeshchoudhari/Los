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
@Table(name = "partner_profiles", schema = "dsa")
public class PartnerProfile extends BaseEntity {

    @Column(name = "partner_id", nullable = false, unique = true)
    private String partnerId;

    @Column(name = "profile_summary", columnDefinition = "text")
    private String profileSummary;

    @Column(name = "team_size")
    private Integer teamSize;

    @Column(name = "experience_years")
    private Integer experienceYears;

    @Column(name = "coverage_areas", length = 500)
    private String coverageAreas;

    @Column(name = "loan_products_offered", length = 500)
    private String loanProductsOffered;

    @Column(name = "branches_count")
    private Integer branchesCount;

    @Column(name = "documents", columnDefinition = "jsonb")
    private String documents;

    @Column(name = "verification_status", length = 50)
    private String verificationStatus;

    @Column(name = "verified_at")
    private String verifiedAt;

    @Column(name = "verified_by", length = 100)
    private String verifiedBy;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;
}
