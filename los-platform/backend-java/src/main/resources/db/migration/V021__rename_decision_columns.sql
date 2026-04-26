-- Flyway Migration: V021__rename_decision_columns.sql
-- Align decisions table columns with Decision entity

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'decision' AND table_name = 'decisions' AND column_name = 'recommended_amount') 
       AND NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'decision' AND table_name = 'decisions' AND column_name = 'approved_amount') THEN
        ALTER TABLE decision.decisions RENAME COLUMN recommended_amount TO approved_amount;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'decision' AND table_name = 'decisions' AND column_name = 'recommended_tenure_months') 
       AND NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'decision' AND table_name = 'decisions' AND column_name = 'approved_tenure_months') THEN
        ALTER TABLE decision.decisions RENAME COLUMN recommended_tenure_months TO approved_tenure_months;
    END IF;
END $$;
