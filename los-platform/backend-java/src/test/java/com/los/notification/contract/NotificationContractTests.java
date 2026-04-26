package com.los.notification.contract;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@org.springframework.test.context.ActiveProfiles("dev")
public class NotificationContractTests {

    @Autowired
    private MockMvc mvc;

    @org.springframework.boot.test.mock.mockito.MockBean
    private org.springframework.web.client.RestTemplate restTemplate;

    @org.springframework.boot.test.mock.mockito.MockBean
    private org.springframework.mail.javamail.JavaMailSender mailSender;

    @Test
    void sendSmsAcceptsPayload() throws Exception {
        org.mockito.Mockito.when(restTemplate.exchange(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.eq(org.springframework.http.HttpMethod.POST),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(java.util.Map.class)))
            .thenReturn(new org.springframework.http.ResponseEntity<>(java.util.Map.of("messageId", "SMS-123"), org.springframework.http.HttpStatus.OK));

        String payload = "{\"recipientId\": \"user-1\", \"mobile\": \"9876543210\", \"channel\": \"SMS\", \"title\": \"OTP\", \"message\": \"Your OTP is 123456\"}";
        mvc.perform(post("/api/notifications/send").contentType("application/json").content(payload))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isOk());
    }

    @Test
    void sendEmailAcceptsPayload() throws Exception {
        org.mockito.Mockito.when(mailSender.createMimeMessage())
            .thenReturn(org.mockito.Mockito.mock(jakarta.mail.internet.MimeMessage.class));

        String payload = "{\"recipientId\": \"user-1\", \"email\": \"test@example.com\", \"channel\": \"EMAIL\", \"title\": \"Welcome\", \"message\": \"<h1>Welcome to LOS</h1>\"}";
        mvc.perform(post("/api/notifications/send").contentType("application/json").content(payload))
                .andExpect(status().isOk());
    }
}
