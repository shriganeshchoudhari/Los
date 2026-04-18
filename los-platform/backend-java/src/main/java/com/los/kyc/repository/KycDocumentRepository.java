package com.los.kyc.repository;

import com.los.kyc.entity.KycDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KycDocumentRepository extends JpaRepository<KycDocument, String> {

    @Query("SELECT k FROM KycDocument k WHERE k.kycRecordId = :kycRecordId ORDER BY k.uploadDate DESC")
    List<KycDocument> findByKycRecordId(@Param("kycRecordId") String kycRecordId);

    @Query("SELECT k FROM KycDocument k WHERE k.kycRecordId = :kycRecordId AND k.documentType = :documentType")
    Optional<KycDocument> findByKycRecordIdAndDocumentType(@Param("kycRecordId") String kycRecordId, @Param("documentType") String documentType);

    @Query("SELECT k FROM KycDocument k WHERE k.status = :status")
    List<KycDocument> findByStatus(@Param("status") String status);
}
