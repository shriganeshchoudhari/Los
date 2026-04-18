package com.los.common.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

/**
 * Filter that executes once per request and checks for a valid JWT in the
 * Authorization header.
 * If a valid JWT is found, it sets the authentication in the SecurityContext.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);
            log.debug("Found JWT in request: {}", jwt != null ? "YES" : "NO");

            if (jwt != null) {
                if (jwtTokenProvider.isTokenValid(jwt)) {
                    Claims claims = jwtTokenProvider.validateAndGetClaims(jwt);
                    String userId = claims.getSubject();
                    String role = (String) claims.get("role");
                    String sessionId = (String) claims.get("sessionId");

                    log.debug("JWT valid. User: {}, Role: {}, Session: {}", userId, role, sessionId);

                    if (role != null) {
                        try {
                            com.los.common.enums.UserRole userRole = com.los.common.enums.UserRole.valueOf(role);
                            AuthenticatedUser authenticatedUser = AuthenticatedUser.builder()
                                    .id(userId)
                                    .role(userRole)
                                    .sessionId(sessionId)
                                    .build();

                            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                    authenticatedUser, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role)));

                            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                            SecurityContextHolder.getContext().setAuthentication(authentication);
                            log.info("Successfully set security context for user: {}", userId);
                        } catch (IllegalArgumentException e) {
                            log.error("Invalid role in JWT: {}", role);
                        }
                    } else {
                        log.warn("No role found in JWT for user: {}", userId);
                    }
                } else {
                    log.warn("JWT token is invalid or expired");
                }
            }
        } catch (Exception ex) {
            log.error("Could not set user authentication in security context", ex);
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }

        // Check for token in cookies (useful for HttpOnly setup)
        if (request.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                if ("access_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
