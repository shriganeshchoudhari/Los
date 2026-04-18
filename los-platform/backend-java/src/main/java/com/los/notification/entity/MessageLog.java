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
@Table(name = "message_logs", schema = "notification")
public class MessageLog extends BaseEntity {

    @Column(name = "notification_id", nullable = false)
    private String notificationId;

    @Column(name = "recipient", length = 200)
    private String recipient;

    @Column(name = "channel", length = 50)
    private String channel;

    @Column(name = "message", columnDefinition = "text")
    private String message;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "provider", length = 100)
    private String provider;

    @Column(name = "provider_message_id", length = 100)
    private String providerMessageId;

    @Column(name = "response_code", length = 50)
    private String responseCode;

    @Column(name = "response_message", columnDefinition = "text")
    private String responseMessage;

    @Column(name = "sent_timestamp")
    private String sentTimestamp;

    @Column(name = "delivery_timestamp")
    private String deliveryTimestamp;

    @Column(name = "cost", precision = 10, scale = 2)
    private String cost;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;
}
