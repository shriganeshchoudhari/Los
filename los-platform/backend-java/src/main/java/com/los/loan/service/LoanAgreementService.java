package com.los.loan.service;

import com.los.loan.entity.LoanAgreement;
import com.los.loan.repository.LoanApplicationRepository;
import com.los.common.dto.ApiResponse;
import com.los.common.exception.LosException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoanAgreementService {

    private final LoanApplicationRepository loanApplicationRepository;

    @Transactional(readOnly = true)
    public byte[] generatePreview(String applicationId) {
        log.info("Generating loan agreement preview for application: {}", applicationId);
        // Mock PDF generation logic
        return "MOCK LOAN AGREEMENT PREVIEW PDF CONTENT".getBytes();
    }

    @Transactional(readOnly = true)
    public byte[] generatePdf(String applicationId) {
        log.info("Generating final loan agreement PDF for application: {}", applicationId);
        // Mock PDF generation logic
        return "MOCK FINAL LOAN AGREEMENT PDF CONTENT".getBytes();
    }
}
