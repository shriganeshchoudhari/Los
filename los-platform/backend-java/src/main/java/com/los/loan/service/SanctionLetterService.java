package com.los.loan.service;

import com.los.loan.dto.SanctionLetterDto;
import com.los.loan.entity.LoanApplication;
import com.los.loan.entity.LoanAgreement;
import com.los.loan.repository.LoanApplicationRepository;
import com.los.loan.repository.LoanAgreementRepository;
import com.los.common.dto.ApiResponse;
import com.los.common.exception.LosException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class SanctionLetterService {

    private final LoanApplicationRepository loanApplicationRepository;
    private final LoanAgreementRepository loanAgreementRepository;

    public ApiResponse<java.util.Map<String, Object>> generateSanctionLetter(SanctionLetterDto dto) {
        log.info("Generating sanction letter for application: {}", dto.getApplicationId());

        LoanApplication application = loanApplicationRepository.findById(dto.getApplicationId())
            .orElseThrow(() -> new LosException("LOAN_001", "Application not found", 404, false));

        // Create loan agreement
        LoanAgreement agreement = new LoanAgreement();
        agreement.setApplicationId(dto.getApplicationId());
        agreement.setAgreementNumber("LA-" + UUID.randomUUID().toString().substring(0, 8));
        agreement.setPrincipalAmount(dto.getSanctionAmount());
        agreement.setInterestRateBps(dto.getInterestRateBps());
        agreement.setTenureMonths(dto.getTenureMonths());
        agreement.setStatus("PENDING_ESIGN");
        agreement.setEsignStatus("PENDING");

        loanAgreementRepository.save(agreement);

        // Update application
        application.setStatus("SANCTION_LETTER_GENERATED");
        application.setSanctionAmount(dto.getSanctionAmount());
        application.setTenureMonths(dto.getTenureMonths());
        loanApplicationRepository.save(application);

        return ApiResponse.success(java.util.Map.of(
            "agreementNumber", agreement.getAgreementNumber(),
            "sanctionAmount", dto.getSanctionAmount(),
            "interestRate", dto.getInterestRateBps() / 100.0,
            "tenureMonths", dto.getTenureMonths()
        ));
    }
}
