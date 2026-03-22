-- Add Ejar sync columns to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS hijri_dob text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ejar_last_sync timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ejar_contract_status text;
