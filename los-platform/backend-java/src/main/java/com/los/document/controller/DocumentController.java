package com.los.document.controller;

import com.los.document.dto.*;
import com.los.document.entity.Document;
import com.los.document.entity.DocumentStatus;
import com.los.document.entity.SigningLog;
import com.los.document.repository.DocumentRepository;
import com.los.document.service.DocumentService;
import com.los.common.dto.ApiResponse;
import com.los.common.exception.LosException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
@Tag(name = "Documents", description = "Document management — upload, OCR, watermark, eSign")
@SecurityRequirement(name = "bearerAuth")
public class DocumentController {

    private final DocumentService documentService;
    private final DocumentRepository documentRepository;

    // ── Presigned upload URL ──────────────────────────────────────────────────

    @PostMapping("/presigned-url")
    @Operation(summary = "Get presigned upload URL")
    public ResponseEntity<ApiResponse<PresignedUrlResponseDto>> getPresignedUrl(
            @Valid @RequestBody PresignedUrlDto dto) {
        log.info("POST /api/documents/presigned-url — application: {}", dto.getApplicationId());
        return ResponseEntity.ok(
            ApiResponse.success(documentService.getPresignedUrl(dto), "Presigned URL generated"));
    }

    // ── Get document ──────────────────────────────────────────────────────────

    @GetMapping("/{documentId}")
    @Operation(summary = "Get document metadata")
    public ResponseEntity<ApiResponse<DocumentStatusDto>> getDocument(
            @PathVariable String documentId) {
        log.info("GET /api/documents/{}", documentId);
        return ResponseEntity.ok(
            ApiResponse.success(documentService.getDocumentStatus(documentId), "Document retrieved"));
    }

    // ── OCR (POST — trigger, GET — fetch result) ──────────────────────────────

    @PostMapping("/ocr")
    @Operation(summary = "Trigger OCR on a document")
    public ResponseEntity<ApiResponse<OcrResponseDto>> performOcr(
            @Valid @RequestBody OcrRequestDto dto) {
        log.info("POST /api/documents/ocr — document: {}", dto.getDocumentId());
        return ResponseEntity.ok(
            ApiResponse.success(documentService.performOcr(dto), "OCR completed"));
    }

    /**
     * GET /{id}/ocr — Returns the OCR result for a document that has already been processed.
     * The frontend calls this endpoint via documentApi.getOcrResult(documentId).
     */
    @GetMapping("/{id}/ocr")
    @Operation(summary = "Get OCR result for a document")
    public ResponseEntity<ApiResponse<OcrResponseDto>> getOcrResult(
            @PathVariable String id) {
        log.info("GET /api/documents/{}/ocr", id);
        return ResponseEntity.ok(
            ApiResponse.success(documentService.getOcrResult(id), "OCR result retrieved"));
    }

    // ── Watermark ─────────────────────────────────────────────────────────────

    @PostMapping("/{id}/watermark")
    @Operation(summary = "Apply watermark to PDF document")
    public ResponseEntity<ApiResponse<DocumentStatusDto>> addWatermark(
            @PathVariable String id,
            @Valid @RequestBody WatermarkRequestDto dto) {
        log.info("POST /api/documents/{}/watermark", id);
        dto.setDocumentId(id);
        return ResponseEntity.ok(
            ApiResponse.success(documentService.addWatermark(dto), "Watermark applied"));
    }

    // ── Approve / reject ──────────────────────────────────────────────────────

    @PostMapping("/{id}/approve")
    @Operation(summary = "Approve a document (officer review)")
    public ResponseEntity<ApiResponse<DocumentStatusDto>> approveDocument(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        log.info("POST /api/documents/{}/approve", id);
        String remarks = body != null ? body.getOrDefault("remarks", "") : "";
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new LosException("DOC_001", "Document not found", 404, false));
        doc.setVerificationStatus(DocumentStatus.VERIFIED);
        // Add remarks to metadata or somewhere if needed, currently no field in table
        documentRepository.save(doc);
        return ResponseEntity.ok(
            ApiResponse.success(documentService.getDocumentStatus(id), "Document approved"));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject a document (officer review)")
    public ResponseEntity<ApiResponse<DocumentStatusDto>> rejectDocument(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        log.info("POST /api/documents/{}/reject", id);
        String reason = body != null ? body.getOrDefault("reason", "Rejected") : "Rejected";
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new LosException("DOC_001", "Document not found", 404, false));
        doc.setVerificationStatus(DocumentStatus.REJECTED);
        documentRepository.save(doc);
        return ResponseEntity.ok(
            ApiResponse.success(documentService.getDocumentStatus(id), "Document rejected"));
    }

    // ── eSign status ──────────────────────────────────────────────────────────

    @GetMapping("/signing-status/{id}")
    @Operation(summary = "Check eSign status")
    public ResponseEntity<ApiResponse<SigningLog>> getSigningStatus(
            @PathVariable String id) {
        log.info("GET /api/documents/signing-status/{}", id);
        return ResponseEntity.ok(
            ApiResponse.success(documentService.getSigningStatus(id), "Signing status retrieved"));
    }

    // ── List by application ───────────────────────────────────────────────────

    @GetMapping("/application/{applicationId}")
    @Operation(summary = "List all documents for an application")
    public ResponseEntity<ApiResponse<List<DocumentStatusDto>>> getApplicationDocuments(
            @PathVariable String applicationId) {
        log.info("GET /api/documents/application/{}", applicationId);
        return ResponseEntity.ok(
            ApiResponse.success(documentService.getApplicationDocuments(applicationId), "Documents retrieved"));
    }
}
