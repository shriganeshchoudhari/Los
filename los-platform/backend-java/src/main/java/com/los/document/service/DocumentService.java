package com.los.document.service;

import com.los.document.dto.*;
import com.los.document.entity.*;
import com.los.document.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final SigningLogRepository signingLogRepository;
    private final S3Service s3Service;
    private final OcrService ocrService;

    public PresignedUrlResponseDto getPresignedUrl(PresignedUrlDto dto) {
        log.info("Generating presigned URL for application: {}", dto.getApplicationId());

        String documentId = UUID.randomUUID().toString();
        String s3Key = buildS3Key(dto.getApplicationId(), documentId, dto.getDocumentName());

        Document document = new Document();
        document.setId(documentId);
        document.setApplicationId(dto.getApplicationId());
        document.setDocumentName(dto.getDocumentName());
        document.setDocumentType(DocumentType.valueOf(dto.getDocumentType()));
        document.setS3Key(s3Key);
        document.setMimeType(dto.getContentType());
        document.setStatus(DocumentStatus.UPLOADED);

        documentRepository.save(document);

        String presignedUrl = s3Service.generatePresignedUrl(s3Key, Integer.parseInt(dto.getExpiryMinutes()));

        PresignedUrlResponseDto response = new PresignedUrlResponseDto();
        response.setDocumentId(documentId);
        response.setPresignedUrl(presignedUrl);
        response.setObjectKey(s3Key);
        response.setExpiresAt(LocalDateTime.now().plusMinutes(Integer.parseInt(dto.getExpiryMinutes())).toString());

        return response;
    }

    public DocumentStatusDto getDocumentStatus(String documentId) {
        log.info("Fetching document status: {}", documentId);

        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        return mapToStatusDto(doc);
    }

    public OcrResponseDto performOcr(OcrRequestDto dto) {
        log.info("Performing OCR on document: {}", dto.getDocumentId());

        Document doc = documentRepository.findById(dto.getDocumentId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        OcrResponseDto response = ocrService.extractText(doc);
        response.setDocumentId(dto.getDocumentId());

        return response;
    }

    public DocumentStatusDto addWatermark(WatermarkRequestDto dto) {
        log.info("Adding watermark to document: {}", dto.getDocumentId());

        Document doc = documentRepository.findById(dto.getDocumentId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        // Watermarking logic
        doc.setMetadata(dto.getWatermarkText());

        documentRepository.save(doc);

        return mapToStatusDto(doc);
    }

    public SigningLog getSigningStatus(String signingRequestId) {
        log.info("Fetching signing status: {}", signingRequestId);

        return signingLogRepository.findBySigningRequestId(signingRequestId)
                .orElseThrow(() -> new IllegalArgumentException("Signing request not found"));
    }

    public List<DocumentStatusDto> getApplicationDocuments(String applicationId) {
        log.info("Fetching documents for application: {}", applicationId);

        return documentRepository.findByApplicationId(applicationId)
                .stream()
                .map(this::mapToStatusDto)
                .collect(Collectors.toList());
    }

    private String buildS3Key(String applicationId, String documentId, String documentName) {
        return String.format("documents/%s/%s/%s", applicationId, documentId, documentName);
    }

    private DocumentStatusDto mapToStatusDto(Document doc) {
        DocumentStatusDto dto = new DocumentStatusDto();
        dto.setDocumentId(doc.getId());
        dto.setDocumentName(doc.getDocumentName());
        dto.setStatus(doc.getStatus().toString());
        dto.setDocumentType(doc.getDocumentType().toString());
        dto.setUploadedAt(doc.getCreatedAt().toString());
        dto.setVerifiedAt(doc.getUpdatedAt().toString());
        dto.setVerifiedBy(doc.getVerifiedBy());
        dto.setVerificationRemarks(doc.getVerificationRemarks());
        dto.setFileSize(doc.getFileSize());
        dto.setMimeType(doc.getMimeType());
        return dto;
    }
}
