-- DSA Module Schema (dsa schema)
CREATE SCHEMA IF NOT EXISTS dsa;

-- DSA Partners
CREATE TABLE dsa.dsa_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_code VARCHAR(20) NOT NULL UNIQUE,
    partner_name VARCHAR(200) NOT NULL,
    partner_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL',
    contact_person VARCHAR(200),
    mobile VARCHAR(15),
    email VARCHAR(200),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    pan VARCHAR(15),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    commission_structure JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dsa_code ON dsa.dsa_partners (partner_code);
CREATE INDEX idx_dsa_status ON dsa.dsa_partners (status);

-- DSA Users
CREATE TABLE dsa.dsa_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES dsa.dsa_partners(id) ON DELETE CASCADE,
    full_name VARCHAR(200) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(200),
    employee_id VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dsa_user_partner ON dsa.dsa_users (partner_id);

