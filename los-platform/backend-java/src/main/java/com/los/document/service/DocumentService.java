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
        String storageKey = buildS3Key(dto.getApplicationId(), documentId, dto.getDocumentName());

        Document document = new Document();
        document.setId(documentId);
        document.setApplicationId(dto.getApplicationId());
        document.setUserId(UUID.fromString("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")); // Default user
        document.setFileName(dto.getDocumentName());
        document.setDocumentType(DocumentType.valueOf(dto.getDocumentType()));
        document.setStorageKey(storageKey);
        document.setMimeType(dto.getContentType());
        document.setFileSizeBytes(dto.getFileSize());
        document.setVerificationStatus(DocumentStatus.UPLOADED);

        documentRepository.save(document);

        String presignedUrl = s3Service.generatePresignedUrl(storageKey, Integer.parseInt(dto.getExpiryMinutes()));

        PresignedUrlResponseDto response = new PresignedUrlResponseDto();
        response.setDocumentId(documentId);
        response.setPresignedUrl(presignedUrl);
        response.setObjectKey(storageKey);
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

        // Update document with OCR data
        doc.setOcrData(response.getDataJson());
        documentRepository.save(doc);

        return response;
    }

    public OcrResponseDto getOcrResult(String documentId) {
        log.info("Getting OCR result for document: {}", documentId);
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        OcrResponseDto response = new OcrResponseDto();
        response.setDocumentId(documentId);
        response.setDataJson(doc.getOcrData());
        response.setOcrStatus("SUCCESS");
        return response;
    }

    public DocumentStatusDto addWatermark(WatermarkRequestDto dto) {
        log.info("Adding watermark to document: {}", dto.getDocumentId());

        Document doc = documentRepository.findById(dto.getDocumentId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        try {
            byte[] content = s3Service.downloadDocument(doc.getStorageKey());
            
            org.apache.pdfbox.pdmodel.PDDocument pdfDoc;
            if (content == null || content.length == 0) {
                // For mock/test, create a simple page if source is empty
                pdfDoc = new org.apache.pdfbox.pdmodel.PDDocument();
                pdfDoc.addPage(new org.apache.pdfbox.pdmodel.PDPage());
            } else {
                pdfDoc = org.apache.pdfbox.pdmodel.PDDocument.load(content);
            }

            String watermarkText = dto.getWatermarkText() != null ? dto.getWatermarkText() : "LOS PLATFORM - SANCTIONED";

            for (org.apache.pdfbox.pdmodel.PDPage page : pdfDoc.getPages()) {
                try (org.apache.pdfbox.pdmodel.PDPageContentStream contentStream = new org.apache.pdfbox.pdmodel.PDPageContentStream(
                        pdfDoc, page, org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode.APPEND, true, true)) {
                    
                    contentStream.beginText();
                    contentStream.setFont(org.apache.pdfbox.pdmodel.font.PDType1Font.HELVETICA_BOLD, 40);
                    contentStream.setNonStrokingColor(0.86f, 0.86f, 0.86f); // Light gray
                    
                    // Simple diagonal positioning
                    contentStream.setTextMatrix(org.apache.pdfbox.util.Matrix.getRotateInstance(Math.toRadians(45), 150, 300));
                    contentStream.showText(watermarkText);
                    contentStream.endText();
                }
            }

            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            pdfDoc.save(baos);
            pdfDoc.close();

            String originalKey = doc.getStorageKey();
            String watermarkedKey = originalKey.contains(".") 
                ? originalKey.substring(0, originalKey.lastIndexOf(".")) + "_wm.pdf"
                : originalKey + "_wm.pdf";
            
            s3Service.uploadDocument(watermarkedKey, baos.toByteArray());
            
            doc.setStorageKey(watermarkedKey);
            doc.setCategory("WATERMARKED");
            documentRepository.save(doc);

            log.info("Successfully watermarked document {}. New key: {}", dto.getDocumentId(), watermarkedKey);

        } catch (Exception e) {
            log.error("Failed to add watermark to document {}", dto.getDocumentId(), e);
            throw new RuntimeException("Watermarking failed: " + e.getMessage());
        }

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
        dto.setDocumentName(doc.getFileName());
        dto.setStatus(doc.getVerificationStatus() != null ? doc.getVerificationStatus().toString() : "PENDING");
        dto.setDocumentType(doc.getDocumentType().toString());
        dto.setUploadedAt(doc.getCreatedAt() != null ? doc.getCreatedAt().toString() : LocalDateTime.now().toString());
        dto.setVerifiedAt(doc.getVerifiedAt() != null ? doc.getVerifiedAt().toString() : null);
        dto.setVerifiedBy(doc.getVerifiedBy() != null ? doc.getVerifiedBy().toString() : null);
        dto.setFileSize(doc.getFileSizeBytes());
        dto.setMimeType(doc.getMimeType());
        return dto;
    }
}
