package com.los.loan.service;

import com.los.loan.dto.CreateLoanApplicationDto;
import com.los.loan.dto.UpdateApplicationDto;
import com.los.loan.dto.ApplicationResponseDto;
import com.los.loan.dto.ManagerDecisionDto;
import com.los.loan.entity.LoanApplication;
import com.los.loan.entity.LoanStatus;
import com.los.loan.repository.LoanApplicationRepository;
import com.los.common.dto.ApiResponse;
import com.los.common.exception.LosException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Slf4j

@Service
@Transactional
@RequiredArgsConstructor
public class LoanApplicationService {

    private final LoanApplicationRepository loanApplicationRepository;
    private final SseEmitterService sseEmitterService;

    public ApiResponse<ApplicationResponseDto> createApplication(CreateLoanApplicationDto dto) {
        log.info("Creating new loan application for customer: {}", dto.getCustomerId());

        LoanApplication application = new LoanApplication();
        application.setApplicationNumber("LA-" + System.currentTimeMillis());
        application.setCustomerId(dto.getCustomerId());
        application.setLoanType(dto.getLoanType());
        application.setRequestedAmount(dto.getRequestedAmount());
        application.setTenureMonths(0); // Will be set during approval
        application.setStatus(LoanStatus.DRAFT);
        application.setApplicationDate(LocalDate.now());
        application.setEmploymentType(dto.getEmploymentType());
        application.setAnnualIncome(dto.getAnnualIncome());
        application.setIsDeleted(false);

        LoanApplication saved = loanApplicationRepository.save(application);

        sseEmitterService.sendEvent(saved.getId(), "STATUS_UPDATE", "DRAFT");

        ApplicationResponseDto response = mapToDto(saved);
        response.setMessage("Application created successfully");

        return ApiResponse.success(response, "Application created successfully");
    }

    public ApiResponse<ApplicationResponseDto> updateApplication(UpdateApplicationDto dto) {
        log.info("Updating loan application: {}", dto.getApplicationId());

        LoanApplication application = loanApplicationRepository.findById(dto.getApplicationId())
            .orElseThrow(() -> new LosException("LOAN_001", "Application not found", 404, false));

        if (LoanStatus.SUBMITTED.equals(application.getStatus()) || LoanStatus.SANCTIONED.equals(application.getStatus())) {
            throw new LosException("LOAN_002", "Cannot update submitted or approved applications", 409, false);
        }

        if (dto.getLoanType() != null) {
            application.setLoanType(dto.getLoanType());
        }
        if (dto.getRequestedAmount() != null) {
            application.setRequestedAmount(dto.getRequestedAmount());
        }
        if (dto.getEmploymentType() != null) {
            application.setEmploymentType(dto.getEmploymentType());
        }
        if (dto.getAnnualIncome() != null) {
            application.setAnnualIncome(dto.getAnnualIncome());
        }

        LoanApplication saved = loanApplicationRepository.save(application);

        sseEmitterService.sendEvent(saved.getId(), "UPDATE", "Application updated");

        ApplicationResponseDto response = mapToDto(saved);
        response.setMessage("Application updated successfully");

        return ApiResponse.success(response, "Application updated successfully");
    }

    public ApiResponse<ApplicationResponseDto> getApplication(String applicationId) {
        log.info("Getting loan application: {}", applicationId);

        LoanApplication application = loanApplicationRepository.findById(applicationId)
            .orElseThrow(() -> new LosException("LOAN_001", "Application not found", 404, false));

        return ApiResponse.success(mapToDto(application), "Application details retrieved");
    }

    public ApiResponse<Void> submitApplication(String applicationId) {
        log.info("Submitting loan application: {}", applicationId);

        LoanApplication application = loanApplicationRepository.findById(applicationId)
            .orElseThrow(() -> new LosException("LOAN_001", "Application not found", 404, false));

        if (application.getStatus() != LoanStatus.DRAFT) {
            throw new LosException("LOAN_003", "Only draft applications can be submitted", 400, false);
        }

        application.setStatus(LoanStatus.SUBMITTED);
        application.setSubmittedAt(java.time.LocalDateTime.now());
        loanApplicationRepository.save(application);

        sseEmitterService.sendEvent(applicationId, "STATUS_UPDATE", "SUBMITTED");

        return ApiResponse.success(null, "Application submitted successfully");
    }

    public ApiResponse<ApplicationResponseDto> submitManagerDecision(ManagerDecisionDto dto) {
        log.info("Manager decision for application: {} action: {}", dto.getApplicationId(), dto.resolvedAction());

        LoanApplication application = loanApplicationRepository.findById(dto.getApplicationId())
            .orElseThrow(() -> new LosException("LOAN_001", "Application not found", 404, false));

        String action = dto.resolvedAction();
        if (action == null) {
            throw new LosException("LOAN_010", "Decision action is required", 400, false);
        }

        switch (action) {
            case "APPROVED", "CONDITIONALLY_APPROVED", "APPROVE" -> {
                if (dto.getSanctionedAmount() != null) {
                    application.setRequestedAmount(dto.getSanctionedAmount());
                } else if (dto.getApprovalAmount() != null) {
                    application.setRequestedAmount(dto.getApprovalAmount());
                }
                if (dto.getTenureMonths() != null) {
                    application.setTenureMonths(dto.getTenureMonths());
                } else if (dto.getApprovalTenureMonths() != null) {
                    application.setTenureMonths(dto.getApprovalTenureMonths());
                }
                application.setStatus(LoanStatus.SANCTIONED);
            }
            case "REJECTED", "REJECT" -> {
                if (dto.getRemarks() == null || dto.getRemarks().isBlank()) {
                    throw new LosException("LOAN_011", "Rejection remarks are required", 400, false);
                }
                application.setStatus(LoanStatus.REJECTED);
                application.setRejectionReason(dto.getRemarks());
            }
            default -> application.setStatus(LoanStatus.UNDER_REVIEW);
        }

        application.setApprovedAt(java.time.LocalDateTime.now());
        LoanApplication saved = loanApplicationRepository.save(application);

        sseEmitterService.sendEvent(saved.getId(), "STATUS_UPDATE", saved.getStatus().name());

        ApplicationResponseDto response = mapToDto(saved);
        response.setMessage("Decision recorded: " + action);
        return ApiResponse.success(response, "Manager decision applied successfully");
    }

    public ApiResponse<org.springframework.data.domain.Page<ApplicationResponseDto>> getAllApplications(org.springframework.data.domain.Pageable pageable) {
        log.info("Fetching paginated loan applications");
        org.springframework.data.domain.Page<LoanApplication> page = loanApplicationRepository.findAll(pageable);
        
        org.springframework.data.domain.Page<ApplicationResponseDto> dtoPage = page.map(this::mapToDto);

        return ApiResponse.success(dtoPage, "Applications retrieved successfully");
    }

    // ── Private mapper ────────────────────────────────────────────────────────

    private ApplicationResponseDto mapToDto(LoanApplication app) {
        ApplicationResponseDto dto = new ApplicationResponseDto();
        dto.setApplicationId(app.getId());
        dto.setApplicationNumber(app.getApplicationNumber());
        dto.setStatus(app.getStatus());
        dto.setCustomerId(app.getCustomerId());
        dto.setLoanType(app.getLoanType());
        dto.setRequestedAmount(app.getRequestedAmount());
        dto.setSanctionAmount(app.getSanctionAmount());
        dto.setNetDisbursedAmount(app.getNetDisbursedAmount());
        dto.setTenureMonths(app.getTenureMonths());
        dto.setEmploymentType(app.getEmploymentType());
        dto.setAnnualIncome(app.getAnnualIncome());
        dto.setCreditScore(app.getCreditScore());
        dto.setAssignedToUserId(app.getAssignedToUserId());
        dto.setApplicationDate(app.getApplicationDate());
        dto.setSubmittedAt(app.getSubmittedAt());
        dto.setApprovedAt(app.getApprovedAt());
        dto.setRejectedAt(app.getRejectedAt());
        dto.setRejectionReason(app.getRejectionReason());
        dto.setCreatedAt(app.getCreatedAt());
        dto.setUpdatedAt(app.getUpdatedAt() != null ? app.getUpdatedAt() : app.getCreatedAt());
        dto.setApplicantName("Customer #" + (app.getCustomerId() != null
                ? app.getCustomerId().substring(0, Math.min(8, app.getCustomerId().length()))
                : "UNKNOWN"));
        return dto;
    }
}
