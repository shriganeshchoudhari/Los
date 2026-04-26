-- Create message_logs table for Notification Module
CREATE TABLE IF NOT EXISTS notification.message_logs (
    id VARCHAR(255) PRIMARY KEY,
    notification_id VARCHAR(255) NOT NULL,
    recipient VARCHAR(200),
    channel VARCHAR(50),
    message TEXT,
    status VARCHAR(50),
    provider VARCHAR(100),
    provider_message_id VARCHAR(100),
    response_code VARCHAR(50),
    response_message TEXT,
    sent_timestamp VARCHAR(255),
    delivery_timestamp VARCHAR(255),
    cost VARCHAR(255),
    metadata JSONB,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- id is BaseEntity String, but V006 uses UUID for primary keys. BaseEntity generates String.
-- So we use VARCHAR(255) for id to match other BaseEntity String IDs.
