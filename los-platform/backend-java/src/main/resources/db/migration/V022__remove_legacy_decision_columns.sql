-- Flyway Migration: V022__remove_legacy_decision_columns.sql
-- Remove redundant decision_result column which violates NOT NULL constraint

ALTER TABLE decision.decisions DROP COLUMN IF EXISTS decision_result;
