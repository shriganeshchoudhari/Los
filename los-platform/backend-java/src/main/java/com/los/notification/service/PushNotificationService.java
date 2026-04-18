package com.los.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService {

    public void sendPush(String recipientId, String title, String message) {
        log.info("Sending push notification to: {}", recipientId);
        // Push notification logic using provider (Firebase, OneSignal, etc.)
    }
}
