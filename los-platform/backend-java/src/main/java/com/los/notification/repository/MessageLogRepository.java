package com.los.notification.repository;

import com.los.notification.entity.MessageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageLogRepository extends JpaRepository<MessageLog, String> {

    List<MessageLog> findByNotificationId(String notificationId);

    List<MessageLog> findByStatus(String status);

    Optional<MessageLog> findByProviderMessageId(String providerMessageId);

    @Query("SELECT m FROM MessageLog m WHERE m.notificationId = :notificationId ORDER BY m.sentTimestamp DESC")
    List<MessageLog> findByNotificationIdOrderByTimestamp(@Param("notificationId") String notificationId);

    List<MessageLog> findByRecipient(String recipient);

    List<MessageLog> findByChannel(String channel);
}
