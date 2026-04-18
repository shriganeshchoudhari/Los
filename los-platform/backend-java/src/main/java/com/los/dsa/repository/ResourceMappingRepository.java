package com.los.dsa.repository;

import com.los.dsa.entity.ResourceMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ResourceMappingRepository extends JpaRepository<ResourceMapping, String> {

    List<ResourceMapping> findByPartnerId(String partnerId);

    Optional<ResourceMapping> findByUserIdAndPartnerId(String userId, String partnerId);

    List<ResourceMapping> findByIsActiveTrue();

    @Query("SELECT r FROM ResourceMapping r WHERE r.partnerId = :partnerId AND r.isActive = true")
    List<ResourceMapping> findActiveResourcesByPartnerId(@Param("partnerId") String partnerId);

    List<ResourceMapping> findByRole(String role);

    Optional<ResourceMapping> findByUserId(String userId);

    List<ResourceMapping> findByEmail(String email);
}
