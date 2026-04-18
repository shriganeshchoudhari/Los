package com.los.integration.service;

import com.los.integration.dto.NachMandateDto;
import com.los.integration.entity.NachMandate;
import com.los.integration.repository.NachMandateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class NachService {

    private final NachMandateRepository nachMandateRepository;

    public NachMandate createNachMandate(NachMandateDto dto) {
        log.info("Creating NACH mandate for application: {}", dto.getApplicationId());

        NachMandate mandate = new NachMandate();
        mandate.setId(UUID.randomUUID().toString());
        mandate.setApplicationId(dto.getApplicationId());
        mandate.setLoanId(dto.getLoanId());
        mandate.setAccountNumber(dto.getAccountNumber());
        mandate.setIfscCode(dto.getIfscCode());
        mandate.setBankName(dto.getBankName());
        mandate.setAccountHolderName(dto.getAccountHolderName());
        mandate.setMandateAmount(dto.getMandateAmount());
        mandate.setStartDate(dto.getStartDate());
        mandate.setEndDate(dto.getEndDate());
        mandate.setStatus("PENDING");

        return nachMandateRepository.save(mandate);
    }

    public NachMandate getNachMandate(String applicationId) {
        log.info("Fetching NACH mandate for application: {}", applicationId);

        return nachMandateRepository.findByApplicationId(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("NACH mandate not found"));
    }

    public NachMandate updateNachMandateStatus(String mandateId, String status) {
        log.info("Updating NACH mandate status: {}, status: {}", mandateId, status);

        NachMandate mandate = nachMandateRepository.findById(mandateId)
                .orElseThrow(() -> new IllegalArgumentException("NACH mandate not found"));

        mandate.setStatus(status);
        return nachMandateRepository.save(mandate);
    }

    public List<NachMandate> getNachMandatesByLoan(String loanId) {
        log.info("Fetching NACH mandates for loan: {}", loanId);

        return nachMandateRepository.findByLoanId(loanId);
    }
}
