package com.los.notification.repository;

import com.los.notification.entity.NotificationTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, String> {

    Optional<NotificationTemplate> findByTemplateName(String templateName);

    List<NotificationTemplate> findByIsActiveTrue();

    @Query("SELECT t FROM NotificationTemplate t WHERE t.isActive = true AND t.channel = :channel")
    List<NotificationTemplate> findActiveByChannel(@Param("channel") String channel);

    List<NotificationTemplate> findByTemplateType(String templateType);

    List<NotificationTemplate> findByChannelAndIsActiveTrue(String channel);
}
