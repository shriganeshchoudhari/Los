package com.los.kyc.service;

import com.los.kyc.entity.KycRecord;
import com.los.kyc.repository.KycRecordRepository;
import com.los.common.exception.LosException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class KycManagementService {

    private final KycRecordRepository kycRecordRepository;

    public void updateRiskScore(String applicationId, BigDecimal riskScore) {
        log.info("Updating risk score for application: {}", applicationId);

        KycRecord kycRecord = kycRecordRepository.findByApplicationId(applicationId)
            .orElseThrow(() -> new LosException("KYC_001", "KYC record not found", 404, false));

        kycRecord.setOverallRiskScore(riskScore.intValue());
        kycRecordRepository.save(kycRecord);
    }

    public void rejectKyc(String applicationId, String reason) {
        log.info("Rejecting KYC for application: {}", applicationId);

        KycRecord kycRecord = kycRecordRepository.findByApplicationId(applicationId)
            .orElseThrow(() -> new LosException("KYC_001", "KYC record not found", 404, false));

        kycRecord.setStatus(KycRecord.KycStatus.KYC_FAILED);
        kycRecord.setReviewNotes(reason);
        kycRecordRepository.save(kycRecord);
    }

    public List<KycRecord> getKycByStatus(String status) {
        log.info("Getting KYC records with status: {}", status);
        return kycRecordRepository.findByStatus(KycRecord.KycStatus.valueOf(status));
    }
}
