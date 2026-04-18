package com.los.auth.service;

import com.los.auth.dto.LoginResponseDto;
import com.los.auth.entity.RefreshToken;
import com.los.auth.entity.User;
import com.los.auth.repository.RefreshTokenRepository;
import com.los.auth.repository.UserRepository;
import com.los.common.exception.LosException;
import com.los.common.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class TokenService {

    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;

    @Value("${los.jwt.access-token-expiry-minutes:30}")
    private int accessTokenExpiry;

    @Value("${los.jwt.refresh-token-expiry-days:7}")
    private int refreshTokenExpiry;

    public LoginResponseDto generateTokens(String userId, String deviceFingerprint, String ipAddress, String userAgent) {
        log.info("Generating tokens for user: {}", userId);

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new LosException("AUTH_001", "User not found", 404, false));

        String accessToken = jwtTokenProvider.generateAccessToken(
            userId, 
            user.getRole().toString(), 
            null,
            java.util.Arrays.asList("read", "write")
        );
        String jti = UUID.randomUUID().toString();

        String refreshTokenValue = jwtTokenProvider.generateRefreshToken(userId);
        String refreshTokenHash = com.los.common.util.CryptoUtil.sha256(refreshTokenValue);

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUserId(userId);
        refreshToken.setJti(jti);
        refreshToken.setTokenHash(refreshTokenHash);
        refreshToken.setExpiresAt(LocalDateTime.now().plusDays(refreshTokenExpiry));
        refreshToken.setDeviceFingerprint(deviceFingerprint);
        refreshToken.setIpAddress(ipAddress);
        refreshToken.setUserAgent(userAgent);
        refreshToken.setIsRevoked(false);

        refreshTokenRepository.save(refreshToken);
        log.info("Tokens generated successfully for user: {}", userId);

        LoginResponseDto response = new LoginResponseDto();
        response.setAccessToken(accessToken);
        response.setRefreshToken(refreshTokenValue);
        response.setExpiresIn((long) (accessTokenExpiry * 60));
        response.setTokenType("Bearer");
        response.setScope("read write");
        response.setUserId(userId);
        response.setRole(user.getRole().toString());
        response.setMfaRequired(user.getMfaEnabled() ? "true" : "false");

        return response;
    }

    public LoginResponseDto refreshAccessToken(String refreshTokenValue, String deviceFingerprint) {
        log.info("Refreshing access token");

        String tokenHash = com.los.common.util.CryptoUtil.sha256(refreshTokenValue);
        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(tokenHash)
            .orElseThrow(() -> new LosException("AUTH_006", "Invalid refresh token", 401, false));

        if (refreshToken.getIsRevoked()) {
            throw new LosException("AUTH_007", "Refresh token has been revoked", 401, false);
        }

        if (refreshToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new LosException("AUTH_008", "Refresh token has expired", 401, false);
        }

        if (deviceFingerprint != null && !deviceFingerprint.equals(refreshToken.getDeviceFingerprint())) {
            log.warn("Device fingerprint mismatch for user: {}", refreshToken.getUserId());
        }

        String userId = refreshToken.getUserId();
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new LosException("AUTH_001", "User not found", 404, false));

        String newAccessToken = jwtTokenProvider.generateAccessToken(
            userId, 
            user.getRole().toString(), 
            null,
            java.util.Arrays.asList("read", "write")
        );

        LoginResponseDto response = new LoginResponseDto();
        response.setAccessToken(newAccessToken);
        response.setRefreshToken(refreshTokenValue);
        response.setExpiresIn((long) (accessTokenExpiry * 60));
        response.setTokenType("Bearer");
        response.setUserId(userId);
        response.setRole(user.getRole().toString());

        return response;
    }

    public void revokeToken(String tokenOrJti, String reason) {
        log.info("Revoking token: {}", tokenOrJti);

        String tokenHash = com.los.common.util.CryptoUtil.sha256(tokenOrJti);
        RefreshToken token = refreshTokenRepository.findByTokenHash(tokenHash)
            .orElseGet(() -> refreshTokenRepository.findById(tokenOrJti).orElse(null));

        if (token == null) {
            throw new LosException("AUTH_009", "Token not found", 404, false);
        }

        token.setIsRevoked(true);
        token.setRevokedAt(LocalDateTime.now());
        token.setRevokedReason(reason);

        refreshTokenRepository.save(token);
        log.info("Token revoked successfully");
    }

    public void revokeAllUserTokens(String userId, String exceptSessionId, String reason) {
        log.info("Revoking all tokens for user: {}", userId);
        refreshTokenRepository.revokeAllExcept(userId, exceptSessionId, LocalDateTime.now(), reason);
    }
}
