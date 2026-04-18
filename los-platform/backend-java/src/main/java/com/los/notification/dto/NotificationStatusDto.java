package com.los.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationStatusDto {

    private String id;

    private String recipientId;

    private String channel;

    private String status;

    private String sentAt;

    private String deliveryTimestamp;

    private String errorMessage;

    private Integer retryCount;
}
