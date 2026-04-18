package com.los.dsa.service;

import com.los.dsa.entity.DealActivity;
import com.los.dsa.repository.PartnerActivityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class ActivityTrackingService {

    private final PartnerActivityRepository partnerActivityRepository;

    public DealActivity logActivity(String partnerId, String applicationId, String activityType, String createdByUserId) {
        log.info("Logging activity for partner: {}, application: {}", partnerId, applicationId);

        DealActivity activity = new DealActivity();
        activity.setId(UUID.randomUUID().toString());
        activity.setPartnerId(partnerId);
        activity.setApplicationId(applicationId);
        activity.setActivityType(activityType);
        activity.setCreatedByUserId(createdByUserId);
        activity.setActivityDate(LocalDateTime.now().toString());
        activity.setActivityStatus("LOGGED");

        return partnerActivityRepository.save(activity);
    }

    public List<DealActivity> getActivities(String partnerId) {
        log.info("Fetching activities for partner: {}", partnerId);

        return partnerActivityRepository.findByPartnerIdOrderByDate(partnerId);
    }

    public Long getTotalActivities(String partnerId) {
        log.info("Getting total activities count for partner: {}", partnerId);

        return partnerActivityRepository.countByPartnerId(partnerId);
    }
}
