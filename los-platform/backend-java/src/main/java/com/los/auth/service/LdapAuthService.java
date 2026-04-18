package com.los.auth.service;

import com.los.auth.dto.LdapLoginDto;
import com.los.auth.dto.LoginResponseDto;
import com.los.auth.entity.User;
import com.los.auth.repository.UserRepository;
import com.los.common.dto.ApiResponse;
import com.los.common.enums.UserStatus;
import com.los.common.exception.LosException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class LdapAuthService {

    private final UserRepository userRepository;
    private final TokenService tokenService;

    @Value("${los.ldap.enabled:false}")
    private boolean ldapEnabled;

    public ApiResponse<LoginResponseDto> ldapLogin(LdapLoginDto dto) {
        log.info("LDAP login attempt for user: {}", dto.getUsername());

        if (!ldapEnabled) {
            throw new LosException("AUTH_010", "LDAP authentication is not enabled", 503, false);
        }

        User user = userRepository.findByEmployeeId(dto.getUsername())
            .orElseThrow(() -> new LosException("AUTH_011", "Invalid username or password", 401, false));

        if (user.getStatus() == UserStatus.LOCKED) {
            if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(LocalDateTime.now())) {
                throw new LosException("AUTH_002", "User account is locked", 423, false);
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
            dto.getUserAgent()
        );

        return ApiResponse.success(response, "LDAP login successful");
    }
}
