package com.los.notification.service;

import com.los.notification.dto.*;
import com.los.notification.entity.*;
import com.los.notification.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationTemplateRepository templateRepository;
    private final MessageLogRepository messageLogRepository;
    private final RestTemplate restTemplate;
    private final org.springframework.mail.javamail.JavaMailSender mailSender;
    
    @Value("${los.notification.sms-url:http://localhost:8080/sms/send}")
    private String smsUrl;

    @Value("${los.notification.whatsapp-url:http://localhost:8080/whatsapp/send}")
    private String whatsAppUrl;

    @Value("${spring.mail.username:noreply@losplatform.com}")
    private String fromEmail;

    public NotificationStatusDto sendNotification(SendNotificationDto dto) {
        log.info("Sending {} notification to recipient: {}", dto.getChannel(), dto.getRecipientId());

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

        // Dispatch to provider (WireMock in dev)
        try {
            String providerMessageId = switch (dto.getChannel()) {
                case "SMS"       -> sendSms(dto.getMobile(), dto.getMessage());
                case "WHATSAPP"  -> sendWhatsApp(dto.getMobile(), dto.getMessage());
                case "EMAIL"     -> sendEmail(dto.getEmail(), dto.getTitle(), dto.getMessage());
                default -> { log.warn("Unsupported channel: {}", dto.getChannel()); yield ""; }
            };

            saved.setStatus(NotificationStatus.SENT);
            saved.setSentAt(Instant.now().toString());

            // Log delivery
            MessageLog msgLog = new MessageLog();
            msgLog.setId(UUID.randomUUID().toString());
            msgLog.setNotificationId(saved.getId());
            msgLog.setChannel(dto.getChannel());
            msgLog.setProviderMessageId(providerMessageId);
            msgLog.setStatus("SENT");
            messageLogRepository.save(msgLog);

        } catch (Exception e) {
            log.error("Notification delivery failed for {}: {}", dto.getChannel(), e.getMessage());
            saved.setStatus(NotificationStatus.FAILED);
            saved.setErrorMessage(e.getMessage());
            saved.setRetryCount(saved.getRetryCount() != null ? saved.getRetryCount() + 1 : 1);
        }

        return mapToStatusDto(notificationRepository.save(saved));
    }

    private String sendSms(String mobile, String message) {
        if (mobile == null || mobile.isBlank()) { log.warn("SMS skipped — no mobile"); return ""; }
        Map<String, Object> body = Map.of("mobile", mobile, "message", message);
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                smsUrl, HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders()), new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {});
        String messageId = response.getBody() != null ? String.valueOf(response.getBody().get("messageId")) : "";
        log.info("SMS sent to {} — messageId: {}", mobile, messageId);
        return messageId;
    }

    private String sendWhatsApp(String mobile, String message) {
        if (mobile == null || mobile.isBlank()) { log.warn("WhatsApp skipped — no mobile"); return ""; }
        Map<String, Object> body = Map.of("mobile", mobile, "message", message);
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                whatsAppUrl, HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders()), new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {});
        String messageId = response.getBody() != null ? String.valueOf(response.getBody().get("messageId")) : "";
        log.info("WhatsApp sent to {} — messageId: {}", mobile, messageId);
        return messageId;
    }

    private String sendEmail(String email, String subject, String body) {
        if (email == null || email.isBlank()) { log.warn("Email skipped — no email address"); return ""; }
        
        try {
            jakarta.mail.internet.MimeMessage message = mailSender.createMimeMessage();
            org.springframework.mail.javamail.MimeMessageHelper helper = new org.springframework.mail.javamail.MimeMessageHelper(message, true);
            
            helper.setFrom(fromEmail);
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(body, true); // true = HTML
            
            mailSender.send(message);
            
            String messageId = "EMAIL-" + UUID.randomUUID().toString().substring(0, 8);
            log.info("Email [{}] sent to {} — messageId: {}", subject, email, messageId);
            return messageId;
        } catch (Exception e) {
            log.error("Failed to send email to {}", email, e);
            throw new RuntimeException("Email delivery failed: " + e.getMessage());
        }
    }

    public NotificationStatusDto getNotificationStatus(String notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found: " + notificationId));
        return mapToStatusDto(notification);
    }

    public TemplateDataDto createTemplate(TemplateDataDto dto) {
        NotificationTemplate template = new NotificationTemplate();
        template.setId(UUID.randomUUID().toString());
        template.setTemplateName(dto.getTemplateName());
        template.setChannel(dto.getChannel());
        template.setTitleTemplate(dto.getTitleTemplate());
        template.setMessageTemplate(dto.getMessageTemplate());
        template.setVariables(dto.getVariables());
        template.setIsActive(true);
        return mapTemplateToDto(templateRepository.save(template));
    }

    public List<TemplateDataDto> listTemplates() {
        return templateRepository.findByIsActiveTrue().stream()
                .map(this::mapTemplateToDto).collect(Collectors.toList());
    }

    public List<NotificationStatusDto> getNotificationHistory(String recipientId) {
        return notificationRepository.findByRecipientId(recipientId).stream()
                .map(this::mapToStatusDto).collect(Collectors.toList());
    }

    private NotificationStatusDto mapToStatusDto(Notification n) {
        NotificationStatusDto dto = new NotificationStatusDto();
        dto.setId(n.getId());
        dto.setRecipientId(n.getRecipientId());
        dto.setChannel(n.getChannel().toString());
        dto.setStatus(n.getStatus().toString());
        dto.setSentAt(n.getSentAt());
        dto.setDeliveryTimestamp(n.getDeliveryTimestamp());
        dto.setErrorMessage(n.getErrorMessage());
        dto.setRetryCount(n.getRetryCount());
        return dto;
    }

    private TemplateDataDto mapTemplateToDto(NotificationTemplate t) {
        TemplateDataDto dto = new TemplateDataDto();
        dto.setTemplateId(t.getId());
        dto.setTemplateName(t.getTemplateName());
        dto.setChannel(t.getChannel());
        dto.setTitleTemplate(t.getTitleTemplate());
        dto.setMessageTemplate(t.getMessageTemplate());
        dto.setVariables(t.getVariables());
        dto.setIsActive(t.getIsActive());
        return dto;
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }
}
