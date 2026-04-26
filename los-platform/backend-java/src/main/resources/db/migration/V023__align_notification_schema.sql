-- Align notification table with Java entity Notification.java

ALTER TABLE notification.notifications
    RENAME COLUMN user_id TO recipient_id;

-- recipient_id is UUID in the old schema, but Java entity uses String for generic recipientId (UUID or just a generic ID)
ALTER TABLE notification.notifications
    ALTER COLUMN recipient_id TYPE VARCHAR(255);

ALTER TABLE notification.notifications
    ADD COLUMN mobile VARCHAR(20),
    ADD COLUMN email VARCHAR(200),
    ADD COLUMN title VARCHAR(200),
    ADD COLUMN template_id VARCHAR(100),
    ADD COLUMN parent_id VARCHAR(100),
    ADD COLUMN next_retry_at VARCHAR(255),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE notification.notifications
    RENAME COLUMN body TO message;

ALTER TABLE notification.notifications
    RENAME COLUMN failure_reason TO error_message;

-- Change types to string for sent_at and delivery_timestamp as defined in Java entity (or change Java entity to use Instant? Actually let's just keep it as String in DB or alter Java entity. Wait, Java entity uses String for sentAt and deliveryTimestamp, but DB uses TIMESTAMPTZ. Hibernate handles String to VARCHAR. Let's alter DB to VARCHAR for simplicity or let Hibernate map it). Let's alter to VARCHAR.
ALTER TABLE notification.notifications
    ALTER COLUMN sent_at TYPE VARCHAR(255);

ALTER TABLE notification.notifications
    ALTER COLUMN delivered_at TYPE VARCHAR(255);

ALTER TABLE notification.notifications
    RENAME COLUMN delivered_at TO delivery_timestamp;

-- Drop obsolete columns
ALTER TABLE notification.notifications
    DROP COLUMN notification_type,
    DROP COLUMN application_id,
    DROP COLUMN recipient,
    DROP COLUMN subject,
    DROP COLUMN read_at;
