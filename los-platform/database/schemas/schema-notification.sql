-- ============================================================
-- LOS Platform Migration
-- Service: notification-service
-- Database: los_notification
-- Migration: 008_notification_schema
-- Description: Multi-channel notification system - SMS, Email, WhatsApp, Push, In-App
-- ============================================================

CREATE SCHEMA IF NOT EXISTS los_notification;

CREATE OR REPLACE FUNCTION los_notification.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE notif_channel AS ENUM ('SMS','EMAIL','WHATSAPP','PUSH','IN_APP');
CREATE TYPE notif_status AS ENUM ('QUEUED','SENT','DELIVERED','READ','FAILED','BOUNCED','UNDELIVERABLE','OPTED_OUT');
CREATE TYPE notif_category AS ENUM (
    'OTP','APPLICATION_STATUS','KYC_UPDATE','DOCUMENT_REMINDER',
    'DECISION','SANCTION','DISBURSEMENT','EMI_REMINDER',
    'PAYMENT_CONFIRMATION','GENERAL','MARKETING'
);
CREATE TYPE notif_priority AS ENUM ('LOW','NORMAL','HIGH','URGENT');

CREATE TABLE los_notification.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID,
    user_id UUID,
    recipient_id VARCHAR(100) NOT NULL,
    channel notif_channel NOT NULL,
    category notif_category NOT NULL,
    status notif_status NOT NULL DEFAULT 'QUEUED',
    priority notif_priority NOT NULL DEFAULT 'NORMAL',
    template_id UUID,
    template_name VARCHAR(50),
    subject VARCHAR(255),
    rendered_content TEXT,
    raw_payload JSONB,
    dlt_template_id VARCHAR(30),
    entity_id VARCHAR(30),
    provider_message_id VARCHAR(100),
    provider_response JSONB,
    error_code VARCHAR(30),
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    sender_id VARCHAR(30),
    initiated_by UUID,
    initiated_via VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient ON los_notification.notifications (recipient_id, created_at DESC);
CREATE INDEX idx_notif_application ON los_notification.notifications (application_id, created_at DESC) WHERE application_id IS NOT NULL;
CREATE INDEX idx_notif_status ON los_notification.notifications (status, created_at);
CREATE INDEX idx_notif_channel_status ON los_notification.notifications (channel, status);
CREATE INDEX idx_notif_category ON los_notification.notifications (category, created_at);
CREATE INDEX idx_notif_template ON los_notification.notifications (template_id) WHERE template_id IS NOT NULL;

CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON los_notification.notifications
    FOR EACH ROW EXECUTE FUNCTION los_notification.update_updated_at_column();

CREATE TABLE los_notification.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    category notif_category NOT NULL,
    channel notif_channel NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    body_hi TEXT,
    body_bilingual TEXT,
    dlt_template_id VARCHAR(30),
    dlt_entity_id VARCHAR(30),
    variables JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_transactional BOOLEAN NOT NULL DEFAULT TRUE,
    priority notif_priority NOT NULL DEFAULT 'NORMAL',
    min_delay_seconds INT NOT NULL DEFAULT 0,
    max_daily_count INT,
    rate_limit_per_hour INT,
    created_by UUID,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_name, channel)
);

CREATE INDEX idx_tmpl_category_active ON los_notification.notification_templates (category, is_active);

CREATE TRIGGER trg_notification_templates_updated_at
    BEFORE UPDATE ON los_notification.notification_templates
    FOR EACH ROW EXECUTE FUNCTION los_notification.update_updated_at_column();

CREATE TABLE los_notification.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    channel notif_channel NOT NULL,
    is_opted_in BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    contact_value VARCHAR(255) NOT NULL,
    dnd_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    dnd_start_time TIME,
    dnd_end_time TIME,
    categories JSONB,
    last_verified_at TIMESTAMPTZ,
    last_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_notif_pref_user_channel ON los_notification.notification_preferences (user_id, channel);

CREATE TRIGGER trg_notification_preferences_updated_at
    BEFORE UPDATE ON los_notification.notification_preferences
    FOR EACH ROW EXECUTE FUNCTION los_notification.update_updated_at_column();

CREATE TABLE los_notification.notification_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    channel notif_channel NOT NULL,
    category notif_category NOT NULL,
    reason VARCHAR(100),
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_optout_user_channel_category ON los_notification.notification_opt_outs (user_id, channel, category);

CREATE TABLE los_notification.notification_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL,
    provider VARCHAR(30) NOT NULL,
    provider_message_id VARCHAR(100),
    provider_status VARCHAR(30),
    provider_response JSONB,
    attempt_number SMALLINT NOT NULL DEFAULT 1,
    error_code VARCHAR(30),
    error_message TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_notif ON los_notification.notification_delivery_logs (notification_id);

CREATE TABLE los_notification.schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO los_notification.schema_migrations (migration_id) VALUES ('008_notification_schema');
