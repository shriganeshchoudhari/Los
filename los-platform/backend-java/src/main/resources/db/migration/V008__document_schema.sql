-- Document Module Schema (document schema)
CREATE SCHEMA IF NOT EXISTS document;

-- Document Metadata
CREATE TABLE document.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    category VARCHAR(30),
    file_name VARCHAR(300) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    checksum VARCHAR(64),
    ocr_data JSONB,
    verification_status VARCHAR(20) DEFAULT 'PENDING',
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_document_app ON document.documents (application_id);
CREATE INDEX idx_document_type ON document.documents (document_type);
CREATE INDEX idx_document_user ON document.documents (user_id);

