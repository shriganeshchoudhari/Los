package com.los.integration.service;

import com.los.integration.dto.OnusCheckDto;
import com.los.integration.entity.OnusCheck;
import com.los.integration.entity.OnusCheckStatus;
import com.los.integration.repository.OnusCheckRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class OnusService {

    private final OnusCheckRepository onusCheckRepository;

    public OnusCheck performOnusCheck(OnusCheckDto dto) {
        log.info("Performing ONUS check for application: {}", dto.getApplicationId());

        OnusCheck check = new OnusCheck();
        check.setId(UUID.randomUUID().toString());
        check.setApplicationId(dto.getApplicationId());
        check.setApplicantId(dto.getApplicantId());
        check.setPan(dto.getPan());
        check.setName(dto.getName());
        check.setStatus(OnusCheckStatus.IN_PROGRESS);

        return onusCheckRepository.save(check);
    }

    public OnusCheck getOnusCheck(String applicationId) {
        log.info("Fetching ONUS check for application: {}", applicationId);

        return onusCheckRepository.findByApplicationId(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("ONUS check not found"));
    }

    public OnusCheck updateOnusCheckResult(String onusCheckId, String result, String riskLevel) {
        log.info("Updating ONUS check result: {}, risk: {}", onusCheckId, riskLevel);

        OnusCheck check = onusCheckRepository.findById(onusCheckId)
                .orElseThrow(() -> new IllegalArgumentException("ONUS check not found"));

        check.setStatus(result.equals("PASSED") ? OnusCheckStatus.PASSED : OnusCheckStatus.FAILED);
        check.setCheckResult(result);
        check.setRiskLevel(riskLevel);

        return onusCheckRepository.save(check);
    }

    public List<OnusCheck> getFailedChecks() {
        log.info("Fetching failed ONUS checks");

        return onusCheckRepository.findByStatus(OnusCheckStatus.FAILED);
    }
}
