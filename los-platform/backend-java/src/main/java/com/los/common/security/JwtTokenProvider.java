package com.los.common.security;

import com.los.common.exception.LosException;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.*;

/**
 * JWT Token Provider for RS256 (RSA) token generation and validation.
 * Handles JWT creation, validation, and claims extraction.
 */
@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${jwt.private-key-path:keys/private_key.pem}")
    private String privateKeyPath;

    @Value("${jwt.public-key-path:keys/public_key.pem}")
    private String publicKeyPath;

    @Value("${jwt.issuer:los-platform}")
    private String issuer;

    @Value("${jwt.access-token-expiry:900}")
    private long accessTokenExpirySeconds;

    @Value("${jwt.refresh-token-expiry:604800}")
    private long refreshTokenExpirySeconds;

    private PrivateKey privateKey;
    private PublicKey publicKey;

    /**
     * Initialize keys from files (called on component initialization)
     */
    public void initializeKeys() {
        try {
            this.privateKey = loadPrivateKey();
            this.publicKey = loadPublicKey();
            log.info("JWT keys initialized successfully");
        } catch (Exception e) {
            log.error("Failed to initialize JWT keys", e);
            throw new RuntimeException("JWT key initialization failed", e);
        }
    }

    /**
     * Generate an access token
     */
    public String generateAccessToken(String userId, String role, String sessionId, List<String> scopes) {
        return generateToken(userId, role, sessionId, scopes, accessTokenExpirySeconds);
    }

    /**
     * Generate a refresh token
     */
    public String generateRefreshToken(String userId) {
        return generateToken(userId, null, null, null, refreshTokenExpirySeconds);
    }

    /**
     * Generate JWT token with RS256
     */
    private String generateToken(String userId, String role, String sessionId, 
                                List<String> scopes, long expirySeconds) {
        Instant now = Instant.now();
        Instant expiryTime = now.plusSeconds(expirySeconds);
        String jti = UUID.randomUUID().toString();

        JwtBuilder builder = Jwts.builder()
                .subject(userId)
                .issuer(issuer)
                .id(jti)
                .issuedAt(new Date(now.toEpochMilli()))
                .expiration(new Date(expiryTime.toEpochMilli()))
                .signWith(privateKey, SignatureAlgorithm.RS256);

        if (role != null) {
            builder.claim("role", role);
        }
        if (sessionId != null) {
            builder.claim("sessionId", sessionId);
        }
        if (scopes != null && !scopes.isEmpty()) {
            builder.claim("scope", String.join(" ", scopes));
        }

        return builder.compact();
    }

    /**
     * Validate and extract claims from token
     */
    public Claims validateAndGetClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(publicKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            log.warn("JWT token has expired: {}", e.getMessage());
            throw new LosException("AUTH_004", "Token has expired", 401, false);
        } catch (UnsupportedJwtException e) {
            log.warn("Unsupported JWT token: {}", e.getMessage());
            throw new LosException("AUTH_005", "Invalid token format", 401, false);
        } catch (MalformedJwtException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            throw new LosException("AUTH_005", "Invalid token", 401, false);
        } catch (SignatureException e) {
            log.warn("Invalid JWT signature: {}", e.getMessage());
            throw new LosException("AUTH_005", "Invalid token signature", 401, false);
        } catch (IllegalArgumentException e) {
            log.warn("JWT claims string is empty: {}", e.getMessage());
            throw new LosException("AUTH_005", "Empty token", 401, false);
        }
    }

    /**
     * Extract user ID from token
     */
    public String getUserId(String token) {
        return validateAndGetClaims(token).getSubject();
    }

    /**
     * Extract role from token
     */
    public String getRole(String token) {
        return (String) validateAndGetClaims(token).get("role");
    }

    /**
     * Extract session ID from token
     */
    public String getSessionId(String token) {
        return (String) validateAndGetClaims(token).get("sessionId");
    }

    /**
     * Extract JTI (JWT ID) claim
     */
    public String getJti(String token) {
        return validateAndGetClaims(token).getId();
    }

    /**
     * Extract scopes from token
     */
    public List<String> getScopes(String token) {
        String scopeString = (String) validateAndGetClaims(token).get("scope");
        if (scopeString == null || scopeString.isEmpty()) {
            return new ArrayList<>();
        }
        return Arrays.asList(scopeString.split(" "));
    }

    /**
     * Check if token is valid (not expired, not malformed)
     */
    public boolean isTokenValid(String token) {
        try {
            validateAndGetClaims(token);
            return true;
        } catch (LosException e) {
            return false;
        }
    }

    /**
     * Load private key from PEM file
     */
    private PrivateKey loadPrivateKey() throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        String privateKeyPem = new String(Files.readAllBytes(Paths.get(privateKeyPath)))
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");

        byte[] decodedKey = Base64.getDecoder().decode(privateKeyPem);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(decodedKey);
        KeyFactory factory = KeyFactory.getInstance("RSA");
        return factory.generatePrivate(spec);
    }

    /**
     * Load public key from PEM file
     */
    private PublicKey loadPublicKey() throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        String publicKeyPem = new String(Files.readAllBytes(Paths.get(publicKeyPath)))
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");

        byte[] decodedKey = Base64.getDecoder().decode(publicKeyPem);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(decodedKey);
        KeyFactory factory = KeyFactory.getInstance("RSA");
        return factory.generatePublic(spec);
    }
}
