package com.los.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SendNotificationDto {

    @NotBlank(message = "Recipient ID is required")
    private String recipientId;

    private String mobile;

    private String email;

    @NotNull(message = "Channel is required")
    private String channel;

    private String title;

    @NotBlank(message = "Message is required")
    private String message;

    private String templateId;

    private String templateVariables;

    private String metadata;
}
