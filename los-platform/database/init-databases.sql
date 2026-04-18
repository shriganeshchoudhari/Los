-- ============================================================
-- LOS Platform — Database Initialization
-- Creates all 9 service databases on first Postgres startup.
-- Applied via docker-compose postgres volumes or manual init.
-- ============================================================

-- Run as superuser (postgres). All subsequent statements use
-- the los_user role created in docker-compose.

-- NOTE: On first boot, docker-compose mounts migrations dir to
-- /docker-entrypoint-initdb.d. We use a separate setup container
-- (init-migrations) instead to run migrations AFTER DBs exist.

CREATE DATABASE los_platform;
GRANT ALL PRIVILEGES ON DATABASE los_platform TO los_user;

-- Connect to the main database to create schemas
\c los_platform

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS loan;
CREATE SCHEMA IF NOT EXISTS kyc;
CREATE SCHEMA IF NOT EXISTS decision;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS document;
CREATE SCHEMA IF NOT EXISTS notification;
CREATE SCHEMA IF NOT EXISTS dsa;
CREATE SCHEMA IF NOT EXISTS shared;
CREATE SCHEMA IF NOT EXISTS public;

GRANT ALL PRIVILEGES ON ALL SCHEMAS TO los_user;

-- Log
SELECT 'LOS Platform database and schemas initialized in los_platform' AS init_status;
