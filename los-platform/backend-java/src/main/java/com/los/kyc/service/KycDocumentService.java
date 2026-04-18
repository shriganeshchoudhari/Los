package com.los.kyc.service;

import com.los.kyc.dto.KycDocumentDto;
import com.los.kyc.entity.KycDocument;
import com.los.kyc.repository.KycDocumentRepository;
import com.los.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class KycDocumentService {

    private final KycDocumentRepository kycDocumentRepository;

    public ApiResponse<List<KycDocument>> getDocuments(String kycRecordId) {
        log.info("Getting documents for KYC record: {}", kycRecordId);

        List<KycDocument> documents = kycDocumentRepository.findByKycRecordId(kycRecordId);
        return ApiResponse.success(documents, "Documents retrieved successfully");
    }

    public ApiResponse<KycDocumentDto> uploadDocument(String kycRecordId, KycDocumentDto dto) {
        log.info("Uploading document for KYC record: {}", kycRecordId);

        KycDocument document = new KycDocument();
        document.setKycRecordId(kycRecordId);
        document.setDocumentType(dto.getDocumentType());
        document.setDocumentNumber(dto.getDocumentNumber());
        document.setDocumentUrl(dto.getDocumentUrl());
        document.setStatus("UPLOADED");
        document.setUploadDate(LocalDateTime.now());
        document.setIsVerified(false);

        KycDocument saved = kycDocumentRepository.save(document);

        KycDocumentDto response = new KycDocumentDto();
        response.setDocumentId(saved.getId());
        response.setDocumentType(saved.getDocumentType());
        response.setStatus(saved.getStatus());

        return ApiResponse.success(response, "Document uploaded successfully");
    }
}
