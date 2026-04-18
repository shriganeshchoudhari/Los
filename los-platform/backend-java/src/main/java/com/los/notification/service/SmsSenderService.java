package com.los.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SmsSenderService {

    public void sendSms(String recipientId, String mobile, String message) {
        log.info("Sending SMS to: {}", mobile);
        // SMS sending logic using provider (Twilio, AWS SNS, etc.)
    }
}
