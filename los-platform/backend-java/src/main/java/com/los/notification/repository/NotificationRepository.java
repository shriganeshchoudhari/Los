package com.los.notification.repository;

import com.los.notification.entity.Notification;
import com.los.notification.entity.NotificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {

    List<Notification> findByRecipientId(String recipientId);

    List<Notification> findByStatus(NotificationStatus status);

    @Query("SELECT n FROM Notification n WHERE n.recipientId = :recipientId AND n.status = :status")
    List<Notification> findByRecipientIdAndStatus(
            @Param("recipientId") String recipientId,
            @Param("status") NotificationStatus status
    );

    List<Notification> findByChannel(String channel);

    List<Notification> findByTemplateId(String templateId);

    Long countByStatus(NotificationStatus status);
}
