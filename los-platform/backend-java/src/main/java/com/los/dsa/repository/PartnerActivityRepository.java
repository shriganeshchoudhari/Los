package com.los.dsa.repository;

import com.los.dsa.entity.DealActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PartnerActivityRepository extends JpaRepository<DealActivity, String> {

    List<DealActivity> findByPartnerId(String partnerId);

    List<DealActivity> findByApplicationId(String applicationId);

    @Query("SELECT a FROM DealActivity a WHERE a.partnerId = :partnerId ORDER BY a.activityDate DESC")
    List<DealActivity> findByPartnerIdOrderByDate(@Param("partnerId") String partnerId);

    List<DealActivity> findByActivityType(String activityType);

    @Query("SELECT COUNT(a) FROM DealActivity a WHERE a.partnerId = :partnerId")
    Long countByPartnerId(@Param("partnerId") String partnerId);

    @Query("SELECT a FROM DealActivity a WHERE a.partnerId = :partnerId AND a.activityStatus = :status")
    List<DealActivity> findByPartnerIdAndStatus(
            @Param("partnerId") String partnerId,
            @Param("status") String status
    );
}
