package com.los.loan.controller;

import com.los.loan.service.LoanAgreementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/loan-agreement")
@RequiredArgsConstructor
@Tag(name = "Loan Agreement", description = "Loan agreement generation and preview endpoints")
public class LoanAgreementController {

    private final LoanAgreementService loanAgreementService;

    @GetMapping("/{applicationId}/preview")
    @Operation(summary = "Preview Loan Agreement")
    public ResponseEntity<byte[]> preview(@PathVariable String applicationId) {
        log.info("GET /api/loan-agreement/{}/preview", applicationId);
        byte[] pdf = loanAgreementService.generatePreview(applicationId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .body(pdf);
    }

    @GetMapping("/{applicationId}/pdf")
    @Operation(summary = "Download Loan Agreement PDF")
    public ResponseEntity<byte[]> download(@PathVariable String applicationId) {
        log.info("GET /api/loan-agreement/{}/pdf", applicationId);
        byte[] pdf = loanAgreementService.generatePdf(applicationId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"loan-agreement.pdf\"")
                .body(pdf);
    }
}
