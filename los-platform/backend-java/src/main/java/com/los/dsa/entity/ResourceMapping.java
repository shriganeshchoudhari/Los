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
@Table(name = "resource_mappings", schema = "dsa")
public class ResourceMapping extends BaseEntity {

    @Column(name = "partner_id", nullable = false)
    private String partnerId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_name", length = 200)
    private String userName;

    @Column(name = "designation", length = 100)
    private String designation;

    @Column(name = "email", length = 200)
    private String email;

    @Column(name = "mobile", length = 20)
    private String mobile;

    @Column(name = "role", length = 50)
    private String role;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "assigned_at")
    private String assignedAt;

    @Column(name = "assigned_by", length = 100)
    private String assignedBy;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;
}
