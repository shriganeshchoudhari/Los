package com.los.loan.controller;

import com.los.common.dto.ApiResponse;
import com.los.loan.service.SanctionLetterService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sanction-letter")
@RequiredArgsConstructor
@Tag(name = "Sanction Letter")
public class SanctionLetterController {

    private final SanctionLetterService service;

    @GetMapping("/{id}/preview")
    public ResponseEntity<ApiResponse<byte[]>> preview(@PathVariable String id) {
        byte[] pdf = service.generatePreview(id);
        return ResponseEntity.ok(new ApiResponse<>(pdf));
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<ApiResponse<byte[]>> download(@PathVariable String id) {
        byte[] pdf = service.generatePdf(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"sanction-letter.pdf\"")
                .body(new ApiResponse<>(pdf));
    }
}
