package com.los.kyc.controller;

import com.los.common.dto.ApiResponse;
import com.los.common.security.Roles;
import com.los.common.enums.UserRole;
import com.los.kyc.dto.*;
import com.los.kyc.entity.ConsentRecord;
import com.los.kyc.service.KycService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/kyc")
@RequiredArgsConstructor
@Tag(name = "KYC", description = "KYC verification endpoints")
@SecurityRequirement(name = "bearerAuth")
public class KycController {

    private final KycService kycService;

    @PostMapping("/aadhaar/init")
    @Roles({UserRole.APPLICANT, UserRole.LOAN_OFFICER})
    @Operation(summary = "Initiate Aadhaar eKYC", description = "Initiate Aadhaar eKYC verification process")
    public ResponseEntity<ApiResponse<AadhaarInitResponseDto>> initiateAadhaarKyc(
            @Valid @RequestBody InitiateAadhaarKycDto dto) {
        log.info("Initiating Aadhaar KYC for application: {}", dto.getApplicationId());
        AadhaarInitResponseDto result = kycService.initiateAadhaarKyc(dto);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/aadhaar/verify")
    @Roles({UserRole.APPLICANT, UserRole.LOAN_OFFICER})
    @Operation(summary = "Verify Aadhaar OTP", description = "Verify OTP received from UIDAI")
    public ResponseEntity<ApiResponse<KycStatusResponseDto>> verifyAadhaarOtp(
            @Valid @RequestBody VerifyAadhaarOtpDto dto) {
        log.info("Verifying Aadhaar OTP for application: {}", dto.getApplicationId());
        KycStatusResponseDto result = kycService.verifyAadhaarOtp(dto);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/pan/verify")
    @Roles({UserRole.APPLICANT, UserRole.LOAN_OFFICER})
    @Operation(summary = "Verify PAN card", description = "Verify PAN number with NSDL")
    public ResponseEntity<ApiResponse<KycStatusResponseDto>> verifyPan(
            @Valid @RequestBody VerifyPanDto dto) {
        log.info("Verifying PAN for application: {}", dto.getApplicationId());
        KycStatusResponseDto result = kycService.verifyPan(dto);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/face/match")
    @Roles({UserRole.APPLICANT, UserRole.LOAN_OFFICER})
    @Operation(summary = "Perform face match", description = "Match selfie with Aadhaar photo")
    public ResponseEntity<ApiResponse<KycStatusResponseDto>> performFaceMatch(
            @Valid @RequestBody FaceMatchDto dto) {
        log.info("Performing face match for application: {}", dto.getApplicationId());
        KycStatusResponseDto result = kycService.performFaceMatch(dto);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{applicationId}")
    @Roles({UserRole.APPLICANT, UserRole.LOAN_OFFICER, UserRole.CREDIT_ANALYST, UserRole.COMPLIANCE_OFFICER})
    @Operation(summary = "Get KYC status", description = "Retrieve current KYC verification status")
    public ResponseEntity<ApiResponse<KycStatusResponseDto>> getKycStatus(
            @PathVariable String applicationId) {
        log.info("Fetching KYC status for application: {}", applicationId);
        KycStatusResponseDto result = kycService.getKycStatus(applicationId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/check-completion")
    @Roles({UserRole.LOAN_OFFICER, UserRole.SYSTEM})
    @Operation(summary = "Check and update KYC completion status", description = "Validate KYC completion")
    public ResponseEntity<ApiResponse<KycStatusResponseDto>> checkCompletion(
            @Valid @RequestBody Map<String, String> body) {
        String applicationId = body.get("applicationId");
        log.info("Checking KYC completion for application: {}", applicationId);
        KycStatusResponseDto result = kycService.checkKycCompletion(applicationId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/consent")
    @Roles({UserRole.APPLICANT})
    @Operation(summary = "Capture consent", description = "Record user consent for KYC verification")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> captureConsent(
            @Valid @RequestBody ConsentDto dto,
            HttpServletRequest request) {
        log.info("Capturing consent for application: {}", dto.getApplicationId());
        String userId = request.getAttribute("userId") != null ? 
                       request.getAttribute("userId").toString() : 
                       "UNKNOWN";
        
        String ipAddress = getClientIp(request);
        String userAgent = request.getHeader("User-Agent");

        kycService.captureConsent(dto.getApplicationId(), userId, dto.getConsentType(),
                dto.getConsentText(), ipAddress, userAgent);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(Map.of("success", true)));
    }

    @GetMapping("/consent/{applicationId}")
    @Roles({UserRole.APPLICANT, UserRole.LOAN_OFFICER, UserRole.CREDIT_ANALYST, UserRole.COMPLIANCE_OFFICER})
    @Operation(summary = "Get consent records", description = "Retrieve consent records for an application")
    public ResponseEntity<ApiResponse<List<ConsentRecord>>> getConsent(
            @PathVariable String applicationId) {
        log.info("Fetching consent records for application: {}", applicationId);
        List<ConsentRecord> result = kycService.getConsent(applicationId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String xri = request.getHeader("X-Real-IP");
        if (xri != null && !xri.isBlank()) {
            return xri;
        }
        return request.getRemoteAddr();
    }
}

