package com.los.document.controller;

import com.los.document.dto.*;
import com.los.document.entity.SigningLog;
import com.los.document.service.DocumentService;
import com.los.common.dto.ApiResponse;
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

@Slf4j
@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
@Tag(name = "Documents", description = "Document management APIs (Upload, OCR, eSign, Watermark)")
@SecurityRequirement(name = "bearerAuth")
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping("/presigned-url")
    @Operation(summary = "Get S3 presigned URL", description = "Generate presigned URL for document upload")
    public ResponseEntity<ApiResponse<PresignedUrlResponseDto>> getPresignedUrl(
            @Valid @RequestBody PresignedUrlDto dto) {
        log.info("POST /api/documents/presigned-url - Application: {}", dto.getApplicationId());

        PresignedUrlResponseDto response = documentService.getPresignedUrl(dto);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Presigned URL generated successfully"));
    }

    @GetMapping("/{documentId}")
    @Operation(summary = "Retrieve document", description = "Get document details and download URL")
    public ResponseEntity<ApiResponse<DocumentStatusDto>> getDocument(
            @PathVariable String documentId) {
        log.info("GET /api/documents/{} - Fetching document", documentId);

        DocumentStatusDto response = documentService.getDocumentStatus(documentId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Document retrieved successfully"));
    }

    @PostMapping("/ocr")
    @Operation(summary = "Run OCR on image", description = "Extract text from document image using OCR")
    public ResponseEntity<ApiResponse<OcrResponseDto>> performOcr(
            @Valid @RequestBody OcrRequestDto dto) {
        log.info("POST /api/documents/ocr - Document: {}", dto.getDocumentId());

        OcrResponseDto response = documentService.performOcr(dto);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "OCR completed successfully"));
    }

    @PostMapping("/{id}/watermark")
    @Operation(summary = "Add watermark to PDF", description = "Add watermark to PDF document")
    public ResponseEntity<ApiResponse<DocumentStatusDto>> addWatermark(
            @PathVariable String id,
            @Valid @RequestBody WatermarkRequestDto dto) {
        log.info("POST /api/documents/{}/watermark - Adding watermark", id);

        DocumentStatusDto response = documentService.addWatermark(dto);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Watermark added successfully"));
    }

    @GetMapping("/signing-status/{id}")
    @Operation(summary = "Check eSign status", description = "Get status of eSign request")
    public ResponseEntity<ApiResponse<SigningLog>> getSigningStatus(
            @PathVariable String id) {
        log.info("GET /api/documents/signing-status/{} - Fetching status", id);

        SigningLog response = documentService.getSigningStatus(id);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Signing status retrieved successfully"));
    }

    @GetMapping("/application/{applicationId}")
    @Operation(summary = "Get application documents", description = "List all documents for application")
    public ResponseEntity<ApiResponse<List<DocumentStatusDto>>> getApplicationDocuments(
            @PathVariable String applicationId) {
        log.info("GET /api/documents/application/{} - Fetching documents", applicationId);

        List<DocumentStatusDto> response = documentService.getApplicationDocuments(applicationId);
        return ResponseEntity
                .status(HttpStatus.OK)
                .body(ApiResponse.success(response, "Documents retrieved successfully"));
    }
}
