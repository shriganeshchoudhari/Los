package com.los.loan.service;

import com.los.loan.dto.PddWaiveItemDto;
import com.los.loan.entity.PddChecklist;
import com.los.loan.repository.PddChecklistRepository;
import com.los.common.dto.ApiResponse;
import com.los.common.exception.LosException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class PddService {

    private final PddChecklistRepository pddChecklistRepository;

    public List<PddChecklist> getPddChecklist(String applicationId) {
        log.info("Getting PDD checklist for application: {}", applicationId);
        return pddChecklistRepository.findByApplicationId(applicationId);
    }

    public ApiResponse<Void> completeItem(String applicationId, String itemCode) {
        log.info("Completing PDD item: {} for application: {}", itemCode, applicationId);

        PddChecklist item = pddChecklistRepository.findByApplicationIdAndItemCode(applicationId, itemCode)
            .orElseThrow(() -> new LosException("PDD_001", "PDD item not found", 404, false));

        item.setIsCompleted(true);
        item.setCompletionDate(LocalDate.now());
        pddChecklistRepository.save(item);

        return ApiResponse.success(null, "Item completed successfully");
    }

    public ApiResponse<Void> waiveItem(PddWaiveItemDto dto) {
        log.info("Waiving PDD item: {} for application: {}", dto.getItemCode(), dto.getApplicationId());

        PddChecklist item = pddChecklistRepository.findByApplicationIdAndItemCode(dto.getApplicationId(), dto.getItemCode())
            .orElseThrow(() -> new LosException("PDD_001", "PDD item not found", 404, false));

        item.setIsWaived(true);
        item.setWaiverReason(dto.getWaiverReason());
        pddChecklistRepository.save(item);

        return ApiResponse.success(null, "Item waived successfully");
    }

    public ApiResponse<java.util.Map<String, Object>> getPddCompletionStatus(String applicationId) {
        log.info("Getting PDD completion status for application: {}", applicationId);

        int totalItems = pddChecklistRepository.countTotalItems(applicationId);
        int completedItems = pddChecklistRepository.countCompletedItems(applicationId);
        int waivedItems = pddChecklistRepository.countWaivedItems(applicationId);

        int completionPercentage = totalItems > 0 ? ((completedItems + waivedItems) * 100) / totalItems : 0;

        return ApiResponse.success(java.util.Map.of(
            "totalItems", totalItems,
            "completedItems", completedItems,
            "waivedItems", waivedItems,
            "completionPercentage", completionPercentage,
            "isComplete", completionPercentage == 100
        ));
    }
}
