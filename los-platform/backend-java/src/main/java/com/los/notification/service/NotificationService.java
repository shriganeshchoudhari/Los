package com.los.notification.service;

import com.los.notification.dto.*;
import com.los.notification.entity.*;
import com.los.notification.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final MessageLogRepository messageLogRepository;
    private final NotificationTemplateRepository templateRepository;
    private final SmsSenderService smsService;
    private final EmailSenderService emailService;

    public NotificationStatusDto sendNotification(SendNotificationDto dto) {
        log.info("Sending notification to recipient: {}, channel: {}", dto.getRecipientId(), dto.getChannel());

        Notification notification = new Notification();
        notification.setId(UUID.randomUUID().toString());
        notification.setRecipientId(dto.getRecipientId());
        notification.setMobile(dto.getMobile());
        notification.setEmail(dto.getEmail());
        notification.setChannel(NotificationChannel.valueOf(dto.getChannel()));
        notification.setTitle(dto.getTitle());
        notification.setMessage(dto.getMessage());
        notification.setTemplateId(dto.getTemplateId());
        notification.setStatus(NotificationStatus.PENDING);
        notification.setMetadata(dto.getMetadata());

        Notification saved = notificationRepository.save(notification);

        // Send notification based on channel
        if (dto.getChannel().equals("SMS")) {
            smsService.sendSms(dto.getRecipientId(), dto.getMobile(), dto.getMessage());
        } else if (dto.getChannel().equals("EMAIL")) {
            emailService.sendEmail(dto.getRecipientId(), dto.getEmail(), dto.getTitle(), dto.getMessage());
        }

        return mapToStatusDto(saved);
    }

    public NotificationStatusDto getNotificationStatus(String notificationId) {
        log.info("Fetching notification status: {}", notificationId);

        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));

        return mapToStatusDto(notification);
    }

    public TemplateDataDto createTemplate(TemplateDataDto dto) {
        log.info("Creating notification template: {}", dto.getTemplateName());

        NotificationTemplate template = new NotificationTemplate();
        template.setId(UUID.randomUUID().toString());
        template.setTemplateName(dto.getTemplateName());
        template.setChannel(dto.getChannel());
        template.setTitleTemplate(dto.getTitleTemplate());
        template.setMessageTemplate(dto.getMessageTemplate());
        template.setVariables(dto.getVariables());
        template.setIsActive(true);

        NotificationTemplate saved = templateRepository.save(template);
        return mapTemplateToDto(saved);
    }

    public List<TemplateDataDto> listTemplates() {
        log.info("Listing all templates");

        return templateRepository.findByIsActiveTrue()
                .stream()
                .map(this::mapTemplateToDto)
                .collect(Collectors.toList());
    }

    public List<NotificationStatusDto> getNotificationHistory(String recipientId) {
        log.info("Fetching notification history for recipient: {}", recipientId);

        return notificationRepository.findByRecipientId(recipientId)
                .stream()
                .map(this::mapToStatusDto)
                .collect(Collectors.toList());
    }

    private NotificationStatusDto mapToStatusDto(Notification notification) {
        NotificationStatusDto dto = new NotificationStatusDto();
        dto.setId(notification.getId());
        dto.setRecipientId(notification.getRecipientId());
        dto.setChannel(notification.getChannel().toString());
        dto.setStatus(notification.getStatus().toString());
        dto.setSentAt(notification.getSentAt());
        dto.setDeliveryTimestamp(notification.getDeliveryTimestamp());
        dto.setErrorMessage(notification.getErrorMessage());
        dto.setRetryCount(notification.getRetryCount());
        return dto;
    }

    private TemplateDataDto mapTemplateToDto(NotificationTemplate template) {
        TemplateDataDto dto = new TemplateDataDto();
        dto.setTemplateId(template.getId());
        dto.setTemplateName(template.getTemplateName());
        dto.setChannel(template.getChannel());
        dto.setTitleTemplate(template.getTitleTemplate());
        dto.setMessageTemplate(template.getMessageTemplate());
        dto.setVariables(template.getVariables());
        dto.setIsActive(template.getIsActive());
        return dto;
    }
}
