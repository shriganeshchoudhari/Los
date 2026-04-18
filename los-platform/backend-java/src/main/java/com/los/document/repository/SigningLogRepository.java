package com.los.document.repository;

import com.los.document.entity.SigningLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SigningLogRepository extends JpaRepository<SigningLog, String> {

    List<SigningLog> findByDocumentId(String documentId);

    Optional<SigningLog> findBySigningRequestId(String signingRequestId);

    @Query("SELECT s FROM SigningLog s WHERE s.signingStatus = :status")
    List<SigningLog> findBySigningStatus(@Param("status") String status);

    List<SigningLog> findBySignerEmail(String signerEmail);

    @Query("SELECT s FROM SigningLog s WHERE s.documentId = :documentId ORDER BY s.createdAt DESC")
    List<SigningLog> findByDocumentIdOrderByCreatedAt(@Param("documentId") String documentId);
}
