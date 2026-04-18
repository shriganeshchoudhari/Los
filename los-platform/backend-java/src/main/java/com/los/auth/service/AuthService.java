package com.los.auth.service;

import com.los.auth.dto.*;
import com.los.auth.entity.User;
import com.los.auth.repository.UserRepository;
import com.los.common.dto.ApiResponse;
import com.los.common.enums.UserRole;
import com.los.common.enums.UserStatus;
import com.los.common.exception.LosException;
import com.los.common.util.StringUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class AuthService {

    private final OtpService otpService;
    private final TokenService tokenService;
    private final UserRepository userRepository;

    public ApiResponse<java.util.Map<String, String>> sendOtp(SendOtpDto dto) {
        return otpService.sendOtp(dto);
    }

    public ApiResponse<LoginResponseDto> verifyOtpAndLogin(VerifyOtpDto dto) {
        log.info("Verifying OTP and logging in user: {}", StringUtil.maskMobile(dto.getMobile()));

        otpService.verifyOtp(dto);

        String mobileHash = com.los.common.util.CryptoUtil.hashMobile(dto.getMobile());
        User user = userRepository.findByMobileHash(mobileHash)
                .orElseGet(() -> createNewUser(dto.getMobile(), mobileHash));

        if (user.getStatus() == UserStatus.LOCKED) {
            if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(LocalDateTime.now())) {
                throw new LosException("AUTH_002", "User account is locked. Try again later.", 423, false);
            } else {
                user.setStatus(UserStatus.ACTIVE);
                user.setLockedUntil(null);
            }
        }

        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new LosException("AUTH_003", "User account is suspended", 403, false);
        }

        user.setFailedLoginAttempts(0);
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        LoginResponseDto response = tokenService.generateTokens(
                user.getId(),
                dto.getDeviceFingerprint(),
                dto.getIpAddress(),
                dto.getUserAgent());

        return ApiResponse.success(response, "Login successful");
    }

    public ApiResponse<LoginResponseDto> refreshToken(RefreshTokenDto dto) {
        log.info("Refreshing access token");

        LoginResponseDto response = tokenService.refreshAccessToken(
                dto.getRefreshToken(),
                dto.getDeviceFingerprint());

        return ApiResponse.success(response, "Token refreshed");
    }

    public ApiResponse<Void> logout(String tokenOrJti, String reason) {
        log.info("User logging out");
        tokenService.revokeToken(tokenOrJti, reason != null ? reason : "User logout");
        return ApiResponse.success(null, "Logout successful");
    }

    public ApiResponse<Void> revokeToken(RevokeTokenDto dto) {
        log.info("Revoking token");
        tokenService.revokeToken(dto.getTokenOrJti(), dto.getReason());
        return ApiResponse.success(null, "Token revoked");
    }

    public ApiResponse<Void> revokeAllSessions(RevokeAllSessionsDto dto) {
        log.info("Revoking all sessions for user: {}", dto.getUserId());
        tokenService.revokeAllUserTokens(dto.getUserId(), dto.getExceptSessionId(), dto.getReason());
        return ApiResponse.success(null, "All sessions revoked");
    }

    public ApiResponse<AuthenticatedUserDto> getProfile(String userId) {
        log.debug("Fetching profile for user: {}", userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new LosException("AUTH_007", "User not found", 404, false));

        AuthenticatedUserDto dto = new AuthenticatedUserDto();
        dto.setUserId(user.getId());
        dto.setName(user.getFirstName() != null ? user.getFirstName() + " " + (user.getLastName() != null ? user.getLastName() : "") : user.getMobile());
        dto.setMobile(user.getMobile());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole().name());
        // permissions can be added here if needed
        dto.setLoginTime(user.getLastLoginAt());
        
        return ApiResponse.success(dto, "Profile retrieved successfully");
    }

    private User createNewUser(String mobile, String mobileHash) {
        log.info("Creating new user for mobile: {}", StringUtil.maskMobile(mobile));

        User user = new User();
        user.setMobile(mobile);
        user.setMobileHash(mobileHash);
        user.setRole(UserRole.APPLICANT);
        user.setStatus(UserStatus.ACTIVE);
        user.setMfaEnabled(false);
        user.setFailedLoginAttempts(0);
        user.setIsDeleted(false);

        return userRepository.save(user);
    }
}
