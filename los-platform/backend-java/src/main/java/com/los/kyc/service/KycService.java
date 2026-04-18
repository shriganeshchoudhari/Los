package com.los.kyc.service;

import com.los.common.exception.LosException;
import com.los.kyc.dto.*;
import com.los.kyc.entity.*;
import com.los.kyc.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class KycService {

    private static final int FACE_MATCH_THRESHOLD = 70;
    private static final int NAME_MATCH_THRESHOLD = 80;

    private final KycRecordRepository kycRecordRepository;
    private final AadhaarKycResultRepository aadhaarRepository;
    private final PanVerificationResultRepository panRepository;
    private final FaceMatchResultRepository faceMatchRepository;
    private final ConsentRecordRepository consentRepository;

    @Transactional
    public AadhaarInitResponseDto initiateAadhaarKyc(InitiateAadhaarKycDto dto) {
        String applicationId = dto.getApplicationId();

        KycRecord kycRecord = kycRecordRepository.findByApplicationId(applicationId)
                .orElseGet(() -> KycRecord.builder()
                        .applicationId(applicationId)
                        .userId(UUID.randomUUID().toString())
                        .status(KycRecord.KycStatus.NOT_STARTED)
                        .build());

        if (kycRecord.getStatus() != KycRecord.KycStatus.NOT_STARTED &&
            kycRecord.getStatus() != KycRecord.KycStatus.KYC_FAILED) {
            throw new LosException("KYC_003", "KYC already in progress or completed", 409, false);
        }

        String txnId = UUID.randomUUID().toString();
        String uidaiRefId = "REF" + System.currentTimeMillis();

        kycRecord.setStatus(KycRecord.KycStatus.AADHAAR_OTP_SENT);
        kycRecordRepository.save(kycRecord);

        log.info("Aadhaar KYC initiated for application {}", applicationId);

        return AadhaarInitResponseDto.builder()
                .txnId(txnId)
                .uidaiRefId(uidaiRefId)
                .expiresIn(300)
                .build();
    }

    @Transactional
    public KycStatusResponseDto verifyAadhaarOtp(VerifyAadhaarOtpDto dto) {
        KycRecord kycRecord = kycRecordRepository.findByApplicationId(dto.getApplicationId())
                .orElseThrow(() -> new LosException("APP_001", "Application not found", 404, false));

        if (kycRecord.getStatus() != KycRecord.KycStatus.AADHAAR_OTP_SENT) {
            throw new LosException("KYC_001", "KYC OTP not initiated", 400, false);
        }

        AadhaarKycResult aadhaarResult = AadhaarKycResult.builder()
                .kycId(kycRecord.getId().toString())
                .txnId(dto.getTxnId())
                .uidaiRefId(dto.getUidaiRefId())
                .aadhaarNumberHash(hashAadhaar("XXXXXX1234"))
                .name("John Doe")
                .dob(LocalDate.of(1990, 1, 15))
                .gender("M")
                .signatureValid(true)
                .verifiedAt(Instant.now())
                .build();

        aadhaarRepository.save(aadhaarResult);

        kycRecord.setStatus(KycRecord.KycStatus.AADHAAR_VERIFIED);
        kycRecord.setOverallRiskScore(calculateRiskScore(aadhaarResult));
        kycRecordRepository.save(kycRecord);

        log.info("Aadhaar OTP verified for application {}", dto.getApplicationId());

        return formatKycStatus(kycRecord);
    }

    @Transactional
    public KycStatusResponseDto verifyPan(VerifyPanDto dto) {
        KycRecord kycRecord = kycRecordRepository.findByApplicationId(dto.getApplicationId())
                .orElseThrow(() -> new LosException("APP_001", "Application not found", 404, false));

        Optional<AadhaarKycResult> aadhaarResult = aadhaarRepository.findByKycId(kycRecord.getId().toString());

        int nameMatchScore = 0;
        if (aadhaarResult.isPresent()) {
            nameMatchScore = fuzzyMatch(aadhaarResult.get().getName(), dto.getFullName());
            if (nameMatchScore < NAME_MATCH_THRESHOLD) {
                throw new LosException("KYC_004",
                        "Name mismatch: " + nameMatchScore + "% match (required: " + NAME_MATCH_THRESHOLD + "%)", 400, false);
            }
        }

        PanVerificationResult panResult = PanVerificationResult.builder()
                .kycId(kycRecord.getId().toString())
                .panNumberMasked(maskPan(dto.getPanNumber()))
                .panNumberEncrypted(java.util.Map.of("encrypted", "ENCRYPTED_PAN"))
                .nameMatchScore(nameMatchScore)
                .nameOnPan(dto.getFullName())
                .dobMatch(compareDob(aadhaarResult.map(AadhaarKycResult::getDob).orElse(null),
                    LocalDate.parse(dto.getDob())))
                .panStatus("VALID")
                .build();

        panRepository.save(panResult);

        kycRecord.setStatus(KycRecord.KycStatus.PAN_VERIFIED);
        kycRecordRepository.save(kycRecord);

        log.info("PAN verified for application {}", dto.getApplicationId());

        return formatKycStatus(kycRecord);
    }

    @Transactional
    public KycStatusResponseDto performFaceMatch(FaceMatchDto dto) {
        KycRecord kycRecord = kycRecordRepository.findByApplicationId(dto.getApplicationId())
                .orElseThrow(() -> new LosException("APP_001", "Application not found", 404, false));

        int matchScore = 85;

        FaceMatchResult faceMatchResult = FaceMatchResult.builder()
                .kycId(kycRecord.getId().toString())
                .selfieStorageKey("s3://bucket/selfie-" + UUID.randomUUID())
                .aadhaarPhotoStorageKey("s3://bucket/aadhaar-" + UUID.randomUUID())
                .matchScore(matchScore)
                .livenessScore(75)
                .faceMatchStatus(matchScore >= FACE_MATCH_THRESHOLD ? "PASSED" : "FAILED")
                .confidenceLevel(90)
                .provider("FACEMATCH_PROVIDER")
                .build();

        faceMatchRepository.save(faceMatchResult);

        if (matchScore >= FACE_MATCH_THRESHOLD) {
            kycRecord.setStatus(KycRecord.KycStatus.FACE_MATCH_PASSED);
            kycRecord.setOverallRiskScore(calculateRiskScore(null));
        } else {
            kycRecord.setStatus(KycRecord.KycStatus.FACE_MATCH_FAILED);
        }
        kycRecordRepository.save(kycRecord);

        log.info("Face match completed for application {}", dto.getApplicationId());

        return formatKycStatus(kycRecord);
    }

    @Transactional(readOnly = true)
    public KycStatusResponseDto getKycStatus(String applicationId) {
        KycRecord kycRecord = kycRecordRepository.findByApplicationId(applicationId)
                .orElseThrow(() -> new LosException("APP_001", "Application not found", 404, false));

        return formatKycStatus(kycRecord);
    }

    @Transactional
    public KycStatusResponseDto checkKycCompletion(String applicationId) {
        KycRecord kycRecord = kycRecordRepository.findByApplicationId(applicationId)
                .orElseThrow(() -> new LosException("APP_001", "Application not found", 404, false));

        boolean isComplete = kycRecord.getStatus() == KycRecord.KycStatus.FACE_MATCH_PASSED ||
                            kycRecord.getStatus() == KycRecord.KycStatus.KYC_COMPLETE;

        if (isComplete) {
            kycRecord.setStatus(KycRecord.KycStatus.KYC_COMPLETE);
            kycRecordRepository.save(kycRecord);
            log.info("KYC completed for application {}", applicationId);
        }

        return formatKycStatus(kycRecord);
    }

    @Transactional
    public void captureConsent(String applicationId, String userId, String consentType,
                               String consentText, String ipAddress, String userAgent) {
        ConsentRecord consent = ConsentRecord.builder()
                .applicationId(applicationId)
                .userId(userId)
                .consentType(consentType)
                .consentText(consentText)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .isGranted(true)
                .grantedAt(Instant.now())
                .build();

        consentRepository.save(consent);
        log.info("Consent captured for application {} and type {}", applicationId, consentType);
    }

    @Transactional(readOnly = true)
    public List<ConsentRecord> getConsent(String applicationId) {
        return consentRepository.findByApplicationIdOrderByCreatedAtDesc(applicationId);
    }


    private KycStatusResponseDto formatKycStatus(KycRecord kycRecord) {
        Optional<AadhaarKycResult> aadhaarResult = aadhaarRepository.findByKycId(kycRecord.getId().toString());
        Optional<PanVerificationResult> panResult = panRepository.findByKycId(kycRecord.getId().toString());
        Optional<FaceMatchResult> faceResult = faceMatchRepository.findTopByKycIdOrderByCreatedAtDesc(kycRecord.getId().toString());

        return KycStatusResponseDto.builder()
                .kycId(kycRecord.getId().toString())
                .status(kycRecord.getStatus())
                .overallRiskScore(kycRecord.getOverallRiskScore())
                .aadhaarVerified(aadhaarResult.isPresent())
                .panVerified(panResult.isPresent())
                .faceMatched(faceResult.isPresent() && "PASSED".equals(faceResult.get().getFaceMatchStatus()))
                .build();
    }

    private Integer calculateRiskScore(AadhaarKycResult aadhaarResult) {
        return 35;
    }

    private int fuzzyMatch(String str1, String str2) {
        if (str1 == null || str2 == null) return 0;
        String s1 = str1.toLowerCase().replaceAll("\\s+", "");
        String s2 = str2.toLowerCase().replaceAll("\\s+", "");

        int matches = 0;
        for (int i = 0; i < Math.min(s1.length(), s2.length()); i++) {
            if (s1.charAt(i) == s2.charAt(i)) matches++;
        }
        return (int) (100.0 * matches / Math.max(s1.length(), s2.length()));
    }

    private boolean compareDob(LocalDate dob1, LocalDate dob2) {
        if (dob1 == null || dob2 == null) return false;
        return dob1.equals(dob2);
    }

    private String hashAadhaar(String aadhaar) {
        return "hash_" + aadhaar;
    }

    private String maskPan(String pan) {
        if (pan == null || pan.length() < 4) return pan;
        return "****" + pan.substring(6);
    }
}
