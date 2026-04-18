package com.los.notification.controller;

import com.los.notification.dto.*;
import com.los.notification.service.NotificationService;
import com.los.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Tag(name = "Notification", description = "Notification APIs for SMS, Email, WhatsApp, Push")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping("/send")
    @Operation(summary = "Send notification", description = "Send notification via SMS/Email/WhatsApp/Push")
    public ResponseEntity<ApiResponse<NotificationStatusDto>> sendNotification(
            @Valid @RequestBody SendNotificationDto dto) {
        log.info("POST /api/notifications/send - Recipient: {}, Channel: {}", dto.getRecipientId(), dto.getChannel());

        NotificationStatusDto response = notificationService.sendNotification(dto);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Notification sent successfully"));
    }

    @GetMapping("/status/{id}")
    @Operation(summary = "Check notification status", description = "Get status of sent notification")
    public ResponseEntity<ApiResponse<NotificationStatusDto>> getNotificationStatus(
            @PathVariable String id) {
        log.info("GET /api/notifications/status/{} - Fetching status", id);

        NotificationStatusDto response = notificationService.getNotificationStatus(id);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Notification status retrieved"));
    }

    @PostMapping("/template")
    @Operation(summary = "Create notification template", description = "Create template for admin")
    public ResponseEntity<ApiResponse<TemplateDataDto>> createTemplate(
            @Valid @RequestBody TemplateDataDto dto) {
        log.info("POST /api/notifications/template - Creating template: {}", dto.getTemplateName());

        TemplateDataDto response = notificationService.createTemplate(dto);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Template created successfully"));
    }

    @GetMapping("/templates")
    @Operation(summary = "List notification templates", description = "Get all active templates")
    public ResponseEntity<ApiResponse<List<TemplateDataDto>>> listTemplates() {
        log.info("GET /api/notifications/templates - Listing templates");

        List<TemplateDataDto> response = notificationService.listTemplates();
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Templates retrieved successfully"));
    }

    @GetMapping("/history/{recipientId}")
    @Operation(summary = "Get notification history", description = "Get all notifications for recipient")
    public ResponseEntity<ApiResponse<List<NotificationStatusDto>>> getNotificationHistory(
            @PathVariable String recipientId) {
        log.info("GET /api/notifications/history/{} - Fetching history", recipientId);

        List<NotificationStatusDto> response = notificationService.getNotificationHistory(recipientId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Notification history retrieved"));
    }
}
