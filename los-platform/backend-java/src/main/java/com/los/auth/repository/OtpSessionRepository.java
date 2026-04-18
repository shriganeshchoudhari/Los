package com.los.auth.repository;

import com.los.auth.entity.OtpSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OtpSessionRepository extends JpaRepository<OtpSession, String> {

    @Query("SELECT o FROM OtpSession o WHERE o.sessionId = :sessionId AND o.status = 'PENDING'")
    Optional<OtpSession> findActiveBySessionId(@Param("sessionId") String sessionId);

    @Query("SELECT o FROM OtpSession o WHERE o.mobileHash = :mobileHash AND o.status = 'PENDING' AND o.expiresAt > :now")
    List<OtpSession> findActiveSessions(@Param("mobileHash") String mobileHash, @Param("now") LocalDateTime now);

    @Query("SELECT o FROM OtpSession o WHERE o.mobileHash = :mobileHash AND o.purpose = :purpose AND o.status = 'PENDING' ORDER BY o.createdAt DESC LIMIT 1")
    Optional<OtpSession> findLatestByMobileAndPurpose(@Param("mobileHash") String mobileHash, @Param("purpose") String purpose);

    @Query("SELECT COUNT(*) FROM OtpSession o WHERE o.mobileHash = :mobileHash AND o.status = 'PENDING' AND o.expiresAt > :now")
    int countActiveSessions(@Param("mobileHash") String mobileHash, @Param("now") LocalDateTime now);

    @Query("SELECT o FROM OtpSession o WHERE o.sessionId = :sessionId")
    Optional<OtpSession> findBySessionId(@Param("sessionId") String sessionId);
}
