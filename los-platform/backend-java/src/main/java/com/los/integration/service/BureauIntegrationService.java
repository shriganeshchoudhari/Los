package com.los.integration.service;

import com.los.integration.dto.*;
import com.los.integration.entity.*;
import com.los.integration.repository.*;
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
public class BureauIntegrationService {

    private final BureauScoreRepository bureauScoreRepository;

    public BureauScore pullBureauData(PullBureauDto dto) {
        log.info("Pulling bureau data for application: {}, provider: {}", dto.getApplicationId(), dto.getProvider());

        Optional<BureauScore> existing = bureauScoreRepository.findByApplicationIdAndProvider(
                dto.getApplicationId(),
                BureauProvider.valueOf(dto.getProvider())
        );

        if (existing.isPresent()) {
            log.warn("Bureau data already pulled for application: {}", dto.getApplicationId());
            return existing.get();
        }

        BureauScore score = new BureauScore();
        score.setId(UUID.randomUUID().toString());
        score.setApplicationId(dto.getApplicationId());
        score.setApplicantId(dto.getApplicantId());
        score.setProvider(BureauProvider.valueOf(dto.getProvider()));
        score.setStatus(BureauPullStatus.IN_PROGRESS);
        score.setPanHash(dto.getPan());

        return bureauScoreRepository.save(score);
    }

    public List<BureauScore> getBureauScores(String applicationId) {
        log.info("Fetching bureau scores for application: {}", applicationId);
        return bureauScoreRepository.findByApplicationId(applicationId);
    }

    public BureauScore updateBureauScore(String bureauScoreId, String creditScore, String status) {
        log.info("Updating bureau score: {}, creditScore: {}, status: {}", bureauScoreId, creditScore, status);

        BureauScore score = bureauScoreRepository.findById(bureauScoreId)
                .orElseThrow(() -> new IllegalArgumentException("Bureau score not found"));

        score.setStatus(BureauPullStatus.valueOf(status));
        if (creditScore != null) {
            score.setCreditScore(Integer.parseInt(creditScore));
        }

        return bureauScoreRepository.save(score);
    }
}
