package com.los.document.repository;

import com.los.document.entity.DocumentMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentMetadataRepository extends JpaRepository<DocumentMetadata, String> {

    List<DocumentMetadata> findByDocumentId(String documentId);

    Optional<DocumentMetadata> findByDocumentIdAndMetadataKey(String documentId, String metadataKey);

    @Query("SELECT m FROM DocumentMetadata m WHERE m.documentId = :documentId ORDER BY m.createdAt DESC")
    List<DocumentMetadata> findByDocumentIdOrderByCreatedAt(@Param("documentId") String documentId);

    @Query("SELECT m FROM DocumentMetadata m WHERE m.extractionStatus = :status")
    List<DocumentMetadata> findByExtractionStatus(@Param("status") String status);
}
