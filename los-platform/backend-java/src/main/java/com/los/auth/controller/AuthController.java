package com.los.auth.controller;

import com.los.auth.dto.*;
import com.los.auth.service.AuthService;
import com.los.auth.service.LdapAuthService;
import com.los.common.dto.ApiResponse;
import com.los.common.security.JwtTokenProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Authentication and authorization endpoints")
public class AuthController {

    private final AuthService authService;
    private final LdapAuthService ldapAuthService;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * Send OTP to mobile number
     */
    @PostMapping("/otp/send")
    @Operation(summary = "Send OTP", description = "Send OTP to registered mobile number for login or verification")
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "OTP sent successfully"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Invalid request"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "429", description = "Too many requests")
    })
    public ResponseEntity<ApiResponse<java.util.Map<String, String>>> sendOtp(
            @Valid @RequestBody SendOtpDto dto,
            HttpServletRequest request) {
        log.info("OTP send request for mobile");

        dto.setIpAddress(getClientIp(request));
        dto.setUserAgent(request.getHeader("User-Agent"));

        ApiResponse<java.util.Map<String, String>> response = authService.sendOtp(dto);
        return ResponseEntity.ok(response);
    }

    /**
     * Verify OTP and login
     */
    @PostMapping("/otp/verify")
    @Operation(summary = "Verify OTP and Login", description = "Verify OTP and get access token for authenticated user")
    public ResponseEntity<ApiResponse<LoginResponseDto>> verifyOtp(
            @Valid @RequestBody VerifyOtpDto dto,
            HttpServletRequest request) {
        log.info("OTP verification request");

        dto.setIpAddress(getClientIp(request));
        dto.setUserAgent(request.getHeader("User-Agent"));

        ApiResponse<LoginResponseDto> response = authService.verifyOtpAndLogin(dto);
        return ResponseEntity.ok(response);
    }

    /**
     * LDAP login for employees
     */
    @PostMapping("/ldap/login")
    @Operation(summary = "LDAP Login", description = "Login using LDAP credentials for internal employees")
    public ResponseEntity<ApiResponse<LoginResponseDto>> ldapLogin(
            @Valid @RequestBody LdapLoginDto dto,
            HttpServletRequest request) {
        log.info("LDAP login request");

        dto.setIpAddress(getClientIp(request));
        dto.setUserAgent(request.getHeader("User-Agent"));

        ApiResponse<LoginResponseDto> response = ldapAuthService.ldapLogin(dto);
        return ResponseEntity.ok(response);
    }

    /**
     * Refresh access token
     */
    @PostMapping("/token/refresh")
    @Operation(summary = "Refresh Token", description = "Get new access token using valid refresh token")
    public ResponseEntity<ApiResponse<LoginResponseDto>> refreshToken(
            @Valid @RequestBody RefreshTokenDto dto,
            HttpServletRequest request) {
        log.info("Token refresh request");

        dto.setDeviceFingerprint(request.getHeader("X-Device-Fingerprint"));

        ApiResponse<LoginResponseDto> response = authService.refreshToken(dto);
        return ResponseEntity.ok(response);
    }

    /**
     * Logout user
     */
    @PostMapping("/logout")
    @Operation(summary = "Logout", description = "Logout and revoke access token")
    public ResponseEntity<ApiResponse<Void>> logout(
            @RequestHeader("Authorization") String authHeader) {
        log.info("Logout request");

        String token = authHeader.replace("Bearer ", "");
        ApiResponse<Void> response = authService.logout(token, "User logout");
        return ResponseEntity.ok(response);
    }

    /**
     * Revoke specific token
     */
    @PostMapping("/revoke")
    @Operation(summary = "Revoke Token", description = "Revoke a specific token or session")
    public ResponseEntity<ApiResponse<Void>> revokeToken(
            @Valid @RequestBody RevokeTokenDto dto) {
        log.info("Token revoke request");
        ApiResponse<Void> response = authService.revokeToken(dto);
        return ResponseEntity.ok(response);
    }

    /**
     * Revoke all user sessions
     */
    @PostMapping("/sessions/revoke-all")
    @Operation(summary = "Revoke All Sessions", description = "Revoke all active sessions for a user")
    public ResponseEntity<ApiResponse<Void>> revokeAllSessions(
            @Valid @RequestBody RevokeAllSessionsDto dto) {
        log.info("Revoke all sessions request for user: {}", dto.getUserId());
        ApiResponse<Void> response = authService.revokeAllSessions(dto);
        return ResponseEntity.ok(response);
    }

    /**
     * Get JWKS for token validation
     */
    @GetMapping("/.well-known/jwks.json")
    @Operation(summary = "Get JWKS", description = "Get JSON Web Key Set for token validation")
    public ResponseEntity<java.util.Map<String, Object>> getJwks() {
        log.debug("JWKS endpoint called");
        return ResponseEntity.ok(java.util.Map.of(
            "keys", java.util.List.of(jwtTokenProvider.getPublicJwk())
        ));
    }

    /**
     * Get current user profile
     */
    @GetMapping("/profile")
    @Operation(summary = "Get Profile", description = "Get current authenticated user's profile information")
    public ResponseEntity<ApiResponse<AuthenticatedUserDto>> getProfile() {
        Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof com.los.common.security.AuthenticatedUser authenticatedUser)) {
            throw new com.los.common.exception.LosException("AUTH_008", "Not authenticated", 401, false);
        }
        
        ApiResponse<AuthenticatedUserDto> response = authService.getProfile(authenticatedUser.getId());
        return ResponseEntity.ok(response);
    }

    private String getClientIp(HttpServletRequest request) {
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isEmpty() || "unknown".equalsIgnoreCase(clientIp)) {
            clientIp = request.getRemoteAddr();
        }
        return clientIp;
    }
}
