-- Notification Module Schema (notification schema)
CREATE SCHEMA IF NOT EXISTS notification;

-- Notification Templates
CREATE TABLE notification.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL UNIQUE,
    template_type VARCHAR(50),
    title_template VARCHAR(200),
    message_template TEXT NOT NULL,
    channel VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    variables JSONB,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_template_name ON notification.notification_templates (template_name);

-- Notifications
CREATE TABLE notification.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    application_id VARCHAR(50),
    notification_type VARCHAR(30) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    recipient VARCHAR(200) NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failure_reason TEXT,
    retry_count INT DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notification_user ON notification.notifications (user_id);
CREATE INDEX idx_notification_status ON notification.notifications (status);
CREATE INDEX idx_notification_app ON notification.notifications (application_id);

