-- Flyway Migration: V016__increase_token_hash_length.sql
-- Increase token_hash length to match JPA entity definition (255 chars)

ALTER TABLE auth.refresh_tokens 
    ALTER COLUMN token_hash TYPE VARCHAR(255);
