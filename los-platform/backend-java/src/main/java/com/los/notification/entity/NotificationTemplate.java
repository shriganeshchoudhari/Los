package com.los.notification.entity;

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
@Table(name = "notification_templates", schema = "notification")
public class NotificationTemplate extends BaseEntity {

    @Column(name = "template_name", nullable = false, unique = true, length = 100)
    private String templateName;

    @Column(name = "template_type", length = 50)
    private String templateType;

    @Column(name = "title_template", length = 200)
    private String titleTemplate;

    @Column(name = "message_template", columnDefinition = "text", nullable = false)
    private String messageTemplate;

    @Column(name = "channel", length = 50)
    private String channel;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "variables", columnDefinition = "jsonb")
    private String variables;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;
}
