package com.los.dsa.repository;

import com.los.dsa.entity.DsaPartner;
import com.los.dsa.entity.PartnerStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DsaPartnerRepository extends JpaRepository<DsaPartner, String> {

    Optional<DsaPartner> findByPartnerCode(String partnerCode);

    List<DsaPartner> findByStatus(PartnerStatus status);

    List<DsaPartner> findByIsActiveTrue();

    @Query("SELECT p FROM DsaPartner p WHERE p.status = :status AND p.isActive = true")
    List<DsaPartner> findActivePartnersByStatus(@Param("status") PartnerStatus status);

    Optional<DsaPartner> findByGstNumber(String gstNumber);

    Optional<DsaPartner> findByPan(String pan);

    List<DsaPartner> findByCity(String city);

    List<DsaPartner> findByState(String state);

    @Query("SELECT COUNT(p) FROM DsaPartner p WHERE p.status = :status")
    Long countByStatus(@Param("status") PartnerStatus status);
}
