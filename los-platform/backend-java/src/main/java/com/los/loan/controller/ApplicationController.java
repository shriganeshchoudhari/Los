package com.los.loan.controller;

import com.los.loan.dto.ApplicationResponseDto;
import com.los.loan.service.LoanApplicationService;
import com.los.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller for general application-related queries.
 * Mapped to /api/applications to match frontend expectations.
 */
@Slf4j
@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
@Tag(name = "Applications", description = "Generic loan application listing endpoints")
public class ApplicationController {

    private final LoanApplicationService loanApplicationService;

    /**
     * Get paginated list of all applications
     */
    @GetMapping
    @Operation(summary = "List Applications", description = "Get a paginated list of all loan applications")
    public ResponseEntity<ApiResponse<Page<ApplicationResponseDto>>> listApplications(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) {
        
        log.info("List applications request: page={}, limit={}", page, limit);
        
        // Convert 1-based frontend page to 0-based Spring Data page
        Pageable pageable = PageRequest.of(page - 1, limit, Sort.by("createdAt").descending());
        
        ApiResponse<Page<ApplicationResponseDto>> response = loanApplicationService.getAllApplications(pageable);
        return ResponseEntity.ok(response);
    }
}
