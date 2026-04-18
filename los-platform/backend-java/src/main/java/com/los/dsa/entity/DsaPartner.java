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
@Table(name = "dsa_partners", schema = "dsa")
public class DsaPartner extends BaseEntity {

    @Column(name = "partner_code", unique = true, nullable = false, length = 50)
    private String partnerCode;

    @Column(name = "partner_name", nullable = false, length = 200)
    private String partnerName;

    @Column(name = "business_type", length = 50)
    private String businessType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PartnerStatus status = PartnerStatus.PENDING_VERIFICATION;

    @Column(name = "email", length = 200)
    private String email;

    @Column(name = "mobile", length = 20)
    private String mobile;

    @Column(name = "gst_number", unique = true, length = 50)
    private String gstNumber;

    @Column(name = "pan", unique = true, length = 20)
    private String pan;

    @Column(name = "address", length = 500)
    private String address;

    @Column(name = "city", length = 100)
    private String city;

    @Column(name = "state", length = 100)
    private String state;

    @Column(name = "pincode", length = 10)
    private String pincode;

    @Column(name = "relationship_manager", length = 100)
    private String relationshipManager;

    @Column(name = "commission_percentage", precision = 5, scale = 2)
    private String commissionPercentage;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;
}
