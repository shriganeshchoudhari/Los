package com.los.integration.service;

import com.los.integration.dto.DisbursementDto;
import com.los.integration.entity.DisbursementRecord;
import com.los.integration.repository.DisbursementRecordRepository;
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
public class DisbursementService {

    private final DisbursementRecordRepository disbursementRecordRepository;

    public DisbursementRecord createDisbursement(DisbursementDto dto) {
        log.info("Creating disbursement for loan: {}", dto.getLoanId());

        DisbursementRecord record = new DisbursementRecord();
        record.setId(UUID.randomUUID().toString());
        record.setLoanId(dto.getLoanId());
        record.setApplicationId(dto.getApplicationId());
        record.setAmount(dto.getAmount());
        record.setDisbursementMode(dto.getDisbursementMode());
        record.setAccountNumber(dto.getAccountNumber());
        record.setIfscCode(dto.getIfscCode());
        record.setBankName(dto.getBankName());
        record.setTrancheNumber(dto.getTrancheNumber());
        record.setScheduledDate(dto.getScheduledDate());
        record.setStatus("PENDING");

        return disbursementRecordRepository.save(record);
    }

    public DisbursementRecord getDisbursement(String disbursementId) {
        log.info("Fetching disbursement: {}", disbursementId);

        return disbursementRecordRepository.findById(disbursementId)
                .orElseThrow(() -> new IllegalArgumentException("Disbursement not found"));
    }

    public DisbursementRecord updateDisbursementStatus(String disbursementId, String status, String transactionId) {
        log.info("Updating disbursement status: {}, status: {}", disbursementId, status);

        DisbursementRecord record = disbursementRecordRepository.findById(disbursementId)
                .orElseThrow(() -> new IllegalArgumentException("Disbursement not found"));

        record.setStatus(status);
        if (transactionId != null) {
            record.setTransactionId(transactionId);
        }

        return disbursementRecordRepository.save(record);
    }

    public List<DisbursementRecord> getDisbursementsByLoan(String loanId) {
        log.info("Fetching disbursements for loan: {}", loanId);

        return disbursementRecordRepository.findByLoanIdOrderByTranche(loanId);
    }
}
