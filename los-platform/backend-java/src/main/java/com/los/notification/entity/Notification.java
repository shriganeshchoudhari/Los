package com.los.notification.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "notifications", schema = "notification")
public class Notification extends BaseEntity {

    @Column(name = "recipient_id", nullable = false)
    private String recipientId;

    @Column(name = "mobile", length = 20)
    private String mobile;

    @Column(name = "email", length = 200)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false)
    private NotificationChannel channel;

    @Column(name = "title", length = 200)
    private String title;

    @Column(name = "message", columnDefinition = "text")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private NotificationStatus status = NotificationStatus.PENDING;

    @Column(name = "template_id", length = 100)
    private String templateId;

    @Column(name = "parent_id", length = 100)
    private String parentId;

    @Column(name = "sent_at")
    private String sentAt;

    @Column(name = "delivery_timestamp")
    private String deliveryTimestamp;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "retry_count")
    private Integer retryCount = 0;

    @Column(name = "next_retry_at")
    private String nextRetryAt;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;
}
