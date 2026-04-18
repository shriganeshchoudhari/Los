package com.los.decision.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "decision_rules", schema = "decision")
public class DecisionRule extends BaseEntity {

    @Column(name = "rule_code", nullable = false, unique = true, length = 50)
    private String ruleCode;

    @Column(name = "rule_name", nullable = false, length = 200)
    private String ruleName;

    @Column(name = "rule_definition", columnDefinition = "jsonb", nullable = false)
    private String ruleDefinition;

    @Column(name = "priority", nullable = false)
    private Integer priority;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "product_type", length = 50)
    private String productType;

    @Column(name = "rule_version", nullable = false)
    private Integer ruleVersion = 1;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;
}
