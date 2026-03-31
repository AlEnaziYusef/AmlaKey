-- WhatsApp notification columns on tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT true;

-- Maintenance request columns on tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS maintenance_enabled boolean DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS maintenance_token uuid DEFAULT gen_random_uuid();

-- Maintenance requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  unit_number text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('paint','electricity','plumbing','floor','other')),
  description text NOT NULL,
  image_path text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS on maintenance_requests
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own maintenance requests"
  ON maintenance_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own maintenance requests"
  ON maintenance_requests FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_user_id ON maintenance_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tenant_id ON maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_tenants_maintenance_token ON tenants(maintenance_token);

-- RPC function for public (unauthenticated) maintenance request submission
CREATE OR REPLACE FUNCTION submit_maintenance_request(
  p_token uuid,
  p_category text,
  p_description text,
  p_image_path text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_request_id uuid;
BEGIN
  -- Validate token and get tenant info
  SELECT id, property_id, unit_number, user_id
  INTO v_tenant
  FROM tenants
  WHERE maintenance_token = p_token
    AND maintenance_enabled = true
    AND status = 'active';

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Invalid or disabled maintenance token';
  END IF;

  -- Validate category
  IF p_category NOT IN ('paint', 'electricity', 'plumbing', 'floor', 'other') THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;

  -- Insert request
  INSERT INTO maintenance_requests (
    tenant_id, property_id, unit_number, user_id,
    category, description, image_path
  ) VALUES (
    v_tenant.id, v_tenant.property_id, v_tenant.unit_number, v_tenant.user_id,
    p_category, p_description, p_image_path
  ) RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Function to get tenant info by maintenance token (public, read-only)
CREATE OR REPLACE FUNCTION get_maintenance_tenant(p_token uuid)
RETURNS TABLE (
  tenant_name text,
  unit_number text,
  property_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.name, t.unit_number, p.name
  FROM tenants t
  JOIN properties p ON p.id = t.property_id
  WHERE t.maintenance_token = p_token
    AND t.maintenance_enabled = true
    AND t.status = 'active';
END;
$$;
