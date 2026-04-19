package com.los.loan.service;

import com.los.loan.dto.CreateLoanApplicationDto;
import com.los.loan.dto.UpdateApplicationDto;
import com.los.loan.dto.ApplicationResponseDto;
import com.los.loan.dto.ManagerDecisionDto;
import com.los.loan.entity.LoanApplication;
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

    public ApiResponse<ApplicationResponseDto> createApplication(CreateLoanApplicationDto dto) {
        log.info("Creating new loan application for customer: {}", dto.getCustomerId());

        LoanApplication application = new LoanApplication();
        application.setApplicationNumber("LA-" + System.currentTimeMillis());
        application.setCustomerId(dto.getCustomerId());
        application.setLoanType(dto.getLoanType());
        application.setRequestedAmount(dto.getRequestedAmount());
        application.setTenureMonths(0); // Will be set during approval
        application.setStatus("DRAFT");
        application.setApplicationDate(LocalDate.now());
        application.setEmploymentType(dto.getEmploymentType());
        application.setAnnualIncome(dto.getAnnualIncome());
        application.setIsDeleted(false);

        LoanApplication saved = loanApplicationRepository.save(application);

        ApplicationResponseDto response = new ApplicationResponseDto();
        response.setApplicationId(saved.getId());
        response.setApplicationNumber(saved.getApplicationNumber());
        response.setStatus("DRAFT");
        response.setMessage("Application created successfully");
        response.setCreatedAt(java.time.LocalDateTime.now());

        return ApiResponse.success(response, "Application created successfully");
    }

    public ApiResponse<ApplicationResponseDto> updateApplication(UpdateApplicationDto dto) {
        log.info("Updating loan application: {}", dto.getApplicationId());

        LoanApplication application = loanApplicationRepository.findById(dto.getApplicationId())
            .orElseThrow(() -> new LosException("LOAN_001", "Application not found", 404, false));

        if ("SUBMITTED".equals(application.getStatus()) || "APPROVED".equals(application.getStatus())) {
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

        ApplicationResponseDto response = new ApplicationResponseDto();
        response.setApplicationId(saved.getId());
        response.setApplicationNumber(saved.getApplicationNumber());
        response.setStatus(saved.getStatus());
        response.setMessage("Application updated successfully");

        return ApiResponse.success(response, "Application updated successfully");
    }

    public ApiResponse<ApplicationResponseDto> getApplication(String applicationId) {
        log.info("Getting loan application: {}", applicationId);

        LoanApplication application = loanApplicationRepository.findById(applicationId)
            .orElseThrow(() -> new LosException("LOAN_001", "Application not found", 404, false));

        ApplicationResponseDto response = new ApplicationResponseDto();
        response.setApplicationId(application.getId());
        response.setApplicationNumber(application.getApplicationNumber());
        response.setStatus(application.getStatus());
        response.setCreatedAt(application.getCreatedAt());

        return ApiResponse.success(response, "Application details retrieved");
    }

    public ApiResponse<Void> submitApplication(String applicationId) {
        log.info("Submitting loan application: {}", applicationId);

        LoanApplication application = loanApplicationRepository.findById(applicationId)
            .orElseThrow(() -> new LosException("LOAN_001", "Application not found", 404, false));

        if (!"DRAFT".equals(application.getStatus())) {
            throw new LosException("LOAN_003", "Only draft applications can be submitted", 400, false);
        }

        application.setStatus("SUBMITTED");
        application.setSubmittedAt(java.time.LocalDateTime.now());
        loanApplicationRepository.save(application);

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
                application.setStatus("SANCTIONED");
            }
            case "REJECTED", "REJECT" -> {
                if (dto.getRemarks() == null || dto.getRemarks().isBlank()) {
                    throw new LosException("LOAN_011", "Rejection remarks are required", 400, false);
                }
                application.setStatus("REJECTED");
            }
            default -> application.setStatus("PENDING_REVIEW");
        }

        application.setApprovedAt(java.time.LocalDateTime.now());
        LoanApplication saved = loanApplicationRepository.save(application);

        ApplicationResponseDto response = new ApplicationResponseDto();
        response.setApplicationId(saved.getId());
        response.setApplicationNumber(saved.getApplicationNumber());
        response.setStatus(saved.getStatus());
        response.setMessage("Decision recorded: " + action);
        return ApiResponse.success(response, "Manager decision applied successfully");
    }

    public ApiResponse<org.springframework.data.domain.Page<ApplicationResponseDto>> getAllApplications(org.springframework.data.domain.Pageable pageable) {
        log.info("Fetching paginated loan applications");
        org.springframework.data.domain.Page<LoanApplication> page = loanApplicationRepository.findAll(pageable);
        
        org.springframework.data.domain.Page<ApplicationResponseDto> dtoPage = page.map(app -> {
            ApplicationResponseDto dto = new ApplicationResponseDto();
            dto.setApplicationId(app.getId());
            dto.setApplicationNumber(app.getApplicationNumber());
            dto.setStatus(app.getStatus());
            dto.setCreatedAt(app.getCreatedAt());
            
            // Add useful data for the list view
            java.util.Map<String, Object> data = new java.util.HashMap<>();
            data.put("loanType", app.getLoanType());
            data.put("amount", app.getRequestedAmount());
            data.put("customerId", app.getCustomerId());
            dto.setData(data);
            
            return dto;
        });

        return ApiResponse.success(dtoPage, "Applications retrieved successfully");
    }
}
