package com.los.auth.repository;

import com.los.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {

    @Query("SELECT r FROM RefreshToken r WHERE r.jti = :jti AND r.isRevoked = false AND r.expiresAt > :now")
    Optional<RefreshToken> findActiveByJti(@Param("jti") String jti, @Param("now") LocalDateTime now);

    Optional<RefreshToken> findByJti(String jti);

    @Query("SELECT r FROM RefreshToken r WHERE r.userId = :userId AND r.isRevoked = false AND r.expiresAt > :now")
    List<RefreshToken> findActiveByUser(@Param("userId") String userId, @Param("now") LocalDateTime now);

    @Query("SELECT r FROM RefreshToken r WHERE r.tokenHash = :tokenHash AND r.isRevoked = false")
    Optional<RefreshToken> findByTokenHash(@Param("tokenHash") String tokenHash);

    @Query("SELECT r FROM RefreshToken r WHERE r.userId = :userId AND r.isRevoked = false ORDER BY r.createdAt DESC")
    List<RefreshToken> findAllActiveByUser(@Param("userId") String userId);

    @Query("UPDATE RefreshToken r SET r.isRevoked = true, r.revokedAt = :revokedAt, r.revokedReason = :reason WHERE r.userId = :userId AND r.id != :keepSessionId")
    int revokeAllExcept(@Param("userId") String userId, @Param("keepSessionId") String keepSessionId, @Param("revokedAt") LocalDateTime revokedAt, @Param("reason") String reason);
}
