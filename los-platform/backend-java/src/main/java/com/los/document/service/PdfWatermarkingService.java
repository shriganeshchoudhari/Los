package com.los.document.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class PdfWatermarkingService {

    public void addWatermark(String s3Key, String watermarkText, String position) {
        log.info("Adding watermark to PDF: {}", s3Key);
        // PDF watermarking logic
    }
}
