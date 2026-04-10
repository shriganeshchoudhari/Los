-- ============================================================
-- LOS Platform Migration
-- Service: document-service
-- Database: los_document
-- Migration: 007_document_schema
-- Description: Document management - storage metadata, checklists, OCR results, review audit trail
-- Note: Actual files stored in MinIO S3. This DB only stores metadata.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS los_document;

CREATE OR REPLACE FUNCTION los_document.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE document_type AS ENUM (
  'PAN', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE',
  'BANK_STATEMENT', 'SALARY_SLIP_1', 'SALARY_SLIP_2', 'SALARY_SLIP_3', 'ITR', 'FORM_16',
  'VEHICLE_RC', 'PROPERTY_DOCUMENT', 'NOC', 'AGREEMENT_TO_SALE', 'APPROVAL_LETTER',
  'VALUATION_REPORT', 'PHOTO', 'SIGNATURE', 'ADDRESS_PROOF', 'INCOME_PROOF',
  'IDENTITY_PROOF', 'OTHER'
);

CREATE TYPE document_status AS ENUM (
  'PENDING', 'UPLOADED', 'OCR_IN_PROGRESS', 'OCR_COMPLETED', 'OCR_FAILED',
  'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'
);

CREATE TYPE checklist_status AS ENUM ('REQUIRED', 'OPTIONAL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAIVED');

CREATE TYPE ocr_provider AS ENUM ('KARZA', 'SIGNZY', 'INTERNAL');

CREATE TABLE los_document.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    document_type document_type NOT NULL,
    status document_status NOT NULL DEFAULT 'PENDING',
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    checksum VARCHAR(64) NOT NULL DEFAULT '',
    bucket_name VARCHAR(100) NOT NULL,
    object_key VARCHAR(500) NOT NULL,
    presigned_url TEXT,
    presigned_url_expires_at TIMESTAMPTZ,
    ocr_provider ocr_provider,
    ocr_result JSONB,
    ocr_confidence DECIMAL(5,2),
    ocr_error TEXT,
    ocr_attempts INT NOT NULL DEFAULT 0,
    watermarked_object_key VARCHAR(500),
    reviewer_id UUID,
    reviewed_at TIMESTAMPTZ,
    review_remarks TEXT,
    expiry_date VARCHAR(50),
    is_expired BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doc_application_type ON los_document.documents (application_id, document_type);
CREATE INDEX idx_doc_status ON los_document.documents (status);
CREATE INDEX idx_doc_created ON los_document.documents (created_at);

CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON los_document.documents
    FOR EACH ROW EXECUTE FUNCTION los_document.update_updated_at_column();

CREATE TABLE los_document.document_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    document_type document_type NOT NULL,
    status checklist_status NOT NULL DEFAULT 'REQUIRED',
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    reason TEXT,
    document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_checklist_application ON los_document.document_checklists (application_id);

CREATE TRIGGER trg_document_checklists_updated_at
    BEFORE UPDATE ON los_document.document_checklists
    FOR EACH ROW EXECUTE FUNCTION los_document.update_updated_at_column();

CREATE TABLE los_document.document_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    application_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    reviewer_role VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    remarks TEXT,
    rejection_reason_code VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_document ON los_document.document_reviews (document_id);

CREATE TABLE los_document.schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO los_document.schema_migrations (migration_id) VALUES ('007_document_schema');
