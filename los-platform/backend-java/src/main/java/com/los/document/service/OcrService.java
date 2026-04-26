package com.los.document.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.los.document.dto.OcrResponseDto;
import com.los.document.entity.Document;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class OcrService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${los.integration.ocr-url:http://localhost:8080}")
    private String ocrBaseUrl;

    public OcrResponseDto extractText(Document document) {
        log.info("Extracting text from document: {}, type: {}", document.getId(), document.getDocumentType());

        String endpoint = resolveEndpoint(document);
        Map<String, Object> request = new HashMap<>();
        request.put("documentId", document.getId());
        request.put("storageKey", document.getStorageKey());
        request.put("type", document.getDocumentType().toString());

        OcrResponseDto responseDto = new OcrResponseDto();
        responseDto.setDocumentId(document.getId());

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<String> response = restTemplate.exchange(
                    ocrBaseUrl + endpoint,
                    HttpMethod.POST,
                    new HttpEntity<>(request, headers),
                    String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            responseDto.setOcrStatus("COMPLETED");
            responseDto.setConfidence(root.path("confidence").asDouble(0.95));
            responseDto.setOcrProvider(root.path("documentType").asText("WIRE_MOCK_OCR"));
            responseDto.setDataJson(response.getBody());
            responseDto.setProcessingTimeMs(1500L);

        } catch (Exception e) {
            log.error("OCR failed for document {}: {}", document.getId(), e.getMessage());
            responseDto.setOcrStatus("FAILED");
            responseDto.setDataJson("{\"error\": \"" + e.getMessage() + "\"}");
        }

        return responseDto;
    }

    private String resolveEndpoint(Document document) {
        return switch (document.getDocumentType()) {
            case SALARY_SLIP -> "/ocr/salary";
            case BANK_STATEMENT -> "/ocr/bank";
            case PAN -> "/ocr/pan";
            default -> "/ocr/salary"; // Default
        };
    }
}
