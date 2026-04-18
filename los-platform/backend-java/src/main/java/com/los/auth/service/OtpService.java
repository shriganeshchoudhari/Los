package com.los.auth.service;

import com.los.auth.dto.SendOtpDto;
import com.los.auth.dto.VerifyOtpDto;
import com.los.auth.entity.OtpSession;
import com.los.auth.repository.OtpSessionRepository;
import com.los.common.dto.ApiResponse;
import com.los.common.enums.OtpPurpose;
import com.los.common.exception.LosException;
import com.los.common.util.CryptoUtil;
import com.los.common.util.StringUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class OtpService {

    private final OtpSessionRepository otpSessionRepository;

    @Value("${los.otp.validity-minutes:10}")
    private int otpValidityMinutes;

    @Value("${los.otp.max-attempts:3}")
    private int maxAttempts;

    @Value("${los.otp.resend-delay-seconds:30}")
    private int resendDelaySeconds;

    public ApiResponse<java.util.Map<String, String>> sendOtp(SendOtpDto dto) {
        log.info("Sending OTP to mobile: {}", StringUtil.maskMobile(dto.getMobile()));

        if (!Pattern.matches("^[6-9]\\d{9}$", dto.getMobile())) {
            throw new LosException("AUTH_012", "Invalid mobile number format", 400, false);
        }

        String mobileHash = CryptoUtil.hashMobile(dto.getMobile());

        int activeSessions = otpSessionRepository.countActiveSessions(mobileHash, LocalDateTime.now());
        if (activeSessions > 0) {
            throw new LosException("AUTH_013", "OTP already sent. Please try after some time.", 429, true);
        }

        String otp = generateOtp();
        String sessionId = UUID.randomUUID().toString();
        String otpHash = CryptoUtil.hashOtp(otp);

        OtpSession session = new OtpSession();
        session.setMobile(dto.getMobile());
        session.setMobileHash(mobileHash);
        session.setSessionId(sessionId);
        session.setPurpose(dto.getPurpose());
        session.setOtpHash(otpHash);
        session.setChannel(dto.getChannel() != null ? dto.getChannel() : "SMS");
        session.setExpiresAt(LocalDateTime.now().plusMinutes(otpValidityMinutes));
        session.setStatus("PENDING");
        session.setAttemptCount(0);
        session.setMaxAttempts(maxAttempts);
        session.setDeviceFingerprint(dto.getDeviceFingerprint());
        session.setIpAddress(dto.getIpAddress());
        session.setUserAgent(dto.getUserAgent());

        otpSessionRepository.save(session);
        log.info("OTP session created: {}", sessionId);

        return ApiResponse.success(java.util.Map.of(
            "sessionId", sessionId,
            "expiresIn", String.valueOf(otpValidityMinutes * 60)
        ), "OTP sent successfully");
    }

    public ApiResponse<java.util.Map<String, Object>> verifyOtp(VerifyOtpDto dto) {
        log.info("Verifying OTP for mobile: {}", StringUtil.maskMobile(dto.getMobile()));

        String mobileHash = CryptoUtil.hashMobile(dto.getMobile());
        OtpSession session = otpSessionRepository.findBySessionId(dto.getSessionId())
            .orElseThrow(() -> new LosException("AUTH_014", "Invalid or expired OTP session", 400, false));

        if (!session.getMobileHash().equals(mobileHash)) {
            throw new LosException("AUTH_015", "Mobile number does not match session", 400, false);
        }

        if ("EXPIRED".equals(session.getStatus())) {
            throw new LosException("AUTH_016", "OTP has expired", 400, false);
        }

        if ("VERIFIED".equals(session.getStatus())) {
            throw new LosException("AUTH_017", "OTP already verified", 400, false);
        }

        if (session.getExpiresAt().isBefore(LocalDateTime.now())) {
            session.setStatus("EXPIRED");
            otpSessionRepository.save(session);
            throw new LosException("AUTH_016", "OTP has expired", 400, false);
        }

        if (session.getAttemptCount() >= session.getMaxAttempts()) {
            session.setStatus("FAILED");
            otpSessionRepository.save(session);
            throw new LosException("AUTH_018", "Maximum OTP attempts exceeded. Request new OTP.", 400, false);
        }

        String otpHash = CryptoUtil.hashOtp(dto.getOtp());
        if (!session.getOtpHash().equals(otpHash)) {
            session.setAttemptCount(session.getAttemptCount() + 1);
            otpSessionRepository.save(session);
            throw new LosException("AUTH_019", "OTP is incorrect", 400, false);
        }

        session.setStatus("VERIFIED");
        session.setVerifiedAt(LocalDateTime.now());
        otpSessionRepository.save(session);
        log.info("OTP verified successfully for session: {}", dto.getSessionId());

        return ApiResponse.success(java.util.Map.of(
            "sessionId", dto.getSessionId(),
            "verified", true
        ), "OTP verified successfully");
    }

    private String generateOtp() {
        return String.format("%06d", (int) (Math.random() * 1000000));
    }
}
