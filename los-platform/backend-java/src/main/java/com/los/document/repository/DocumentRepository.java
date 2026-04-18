package com.los.document.repository;

import com.los.document.entity.Document;
import com.los.document.entity.DocumentStatus;
import com.los.document.entity.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentRepository extends JpaRepository<Document, String> {

    List<Document> findByApplicationId(String applicationId);

    Optional<Document> findByApplicationIdAndDocumentType(String applicationId, DocumentType documentType);

    List<Document> findByStatus(DocumentStatus status);

    @Query("SELECT d FROM Document d WHERE d.applicationId = :applicationId AND d.status = :status")
    List<Document> findByApplicationIdAndStatus(
            @Param("applicationId") String applicationId,
            @Param("status") DocumentStatus status
    );

    Optional<Document> findByS3Key(String s3Key);

    List<Document> findByDocumentType(DocumentType documentType);

    List<Document> findByUploadedBy(String uploadedBy);

    @Query("SELECT COUNT(d) FROM Document d WHERE d.applicationId = :applicationId")
    Long countByApplicationId(@Param("applicationId") String applicationId);
}
