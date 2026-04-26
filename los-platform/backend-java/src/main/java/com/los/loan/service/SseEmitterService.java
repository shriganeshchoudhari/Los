package com.los.loan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class SseEmitterService {

    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String applicationId) {
        SseEmitter emitter = new SseEmitter(600_000L); // 10 minutes timeout
        
        emitters.put(applicationId, emitter);

        emitter.onCompletion(() -> {
            log.debug("SSE completion for application: {}", applicationId);
            emitters.remove(applicationId);
        });
        
        emitter.onTimeout(() -> {
            log.debug("SSE timeout for application: {}", applicationId);
            emitter.complete();
            emitters.remove(applicationId);
        });

        emitter.onError(e -> {
            log.warn("SSE error for application: {}: {}", applicationId, e.getMessage());
            emitters.remove(applicationId);
        });

        try {
            emitter.send(SseEmitter.event()
                    .name("INIT")
                    .data("Connected to status stream for " + applicationId));
        } catch (IOException e) {
            log.error("Failed to send INIT event for {}: {}", applicationId, e.getMessage());
            emitters.remove(applicationId);
        }

        return emitter;
    }

    public void sendEvent(String applicationId, String eventName, Object data) {
        SseEmitter emitter = emitters.get(applicationId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(data));
                log.debug("Sent SSE event {} to application {}", eventName, applicationId);
            } catch (IOException e) {
                log.warn("Failed to send event to {}: {}", applicationId, e.getMessage());
                emitter.complete();
                emitters.remove(applicationId);
            }
        }
    }
}
