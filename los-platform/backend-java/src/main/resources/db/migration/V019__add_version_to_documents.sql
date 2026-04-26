-- Flyway Migration: V019__add_version_to_documents.sql
-- Add version column for optimistic locking to document.documents table

ALTER TABLE document.documents ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
