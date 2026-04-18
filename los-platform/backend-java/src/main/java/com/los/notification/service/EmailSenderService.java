package com.los.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailSenderService {

    public void sendEmail(String recipientId, String email, String title, String message) {
        log.info("Sending email to: {}", email);
        // Email sending logic using provider (SendGrid, AWS SES, etc.)
    }
}
