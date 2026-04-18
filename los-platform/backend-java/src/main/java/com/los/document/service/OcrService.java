package com.los.document.service;

import com.los.document.dto.OcrResponseDto;
import com.los.document.entity.Document;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class OcrService {

    public OcrResponseDto extractText(Document document) {
        log.info("Extracting text from document: {}", document.getId());

        OcrResponseDto response = new OcrResponseDto();
        response.setOcrStatus("COMPLETED");
        response.setConfidence(0.95);
        response.setOcrProvider("AWS_TEXTRACT");
        response.setProcessingTimeMs(5000L);

        return response;
    }
}
