package com.los.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppService {

    public void sendWhatsApp(String recipientId, String mobile, String message) {
        log.info("Sending WhatsApp to: {}", mobile);
        // WhatsApp sending logic using provider (Twilio, MessageBird, etc.)
    }
}
