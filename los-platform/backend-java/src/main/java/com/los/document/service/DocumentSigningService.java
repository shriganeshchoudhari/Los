package com.los.document.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentSigningService {

    public String initiateEsigning(String documentId, String signerEmail) {
        log.info("Initiating eSign for document: {}", documentId);
        // eSign initiation logic
        return "SIGNING_REQUEST_" + documentId;
    }

    public String checkSigningStatus(String signingRequestId) {
        log.info("Checking signing status: {}", signingRequestId);
        // Status check logic
        return "SIGNED";
    }
}
