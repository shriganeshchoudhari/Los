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

CREATE DATABASE los_auth;
CREATE DATABASE los_loan;
CREATE DATABASE los_kyc;
CREATE DATABASE los_decision;
CREATE DATABASE los_integration;
CREATE DATABASE los_document;
CREATE DATABASE los_notification;
CREATE DATABASE los_dsa;
CREATE DATABASE los_shared;

-- Grant usage on all new databases
GRANT ALL PRIVILEGES ON DATABASE los_auth TO los_user;
GRANT ALL PRIVILEGES ON DATABASE los_loan TO los_user;
GRANT ALL PRIVILEGES ON DATABASE los_kyc TO los_user;
GRANT ALL PRIVILEGES ON DATABASE los_decision TO los_user;
GRANT ALL PRIVILEGES ON DATABASE los_integration TO los_user;
GRANT ALL PRIVILEGES ON DATABASE los_document TO los_user;
GRANT ALL PRIVILEGES ON DATABASE los_notification TO los_user;
GRANT ALL PRIVILEGES ON DATABASE los_dsa TO los_user;
GRANT ALL PRIVILEGES ON DATABASE los_shared TO los_user;

-- Log
SELECT 'LOS Platform databases initialized: los_auth, los_loan, los_kyc, los_decision, los_integration, los_document, los_notification, los_dsa, los_shared' AS init_status;
