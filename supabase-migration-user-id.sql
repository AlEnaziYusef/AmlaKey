-- ============================================================
-- Migration: Add user_id to all tables + enable RLS
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Add user_id column to each table (defaults to current user)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE unit_labels ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);

-- 2. Backfill existing rows with YOUR user ID (replace with your actual user ID)
-- Find your user ID: SELECT id FROM auth.users WHERE email = 'your@email.com';
-- Then uncomment and run:
-- UPDATE properties SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE tenants SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE payments SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE expenses SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE unit_labels SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;

-- 3. Make user_id NOT NULL after backfill
-- (Only run AFTER you've backfilled existing rows above)
-- ALTER TABLE properties ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE tenants ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE payments ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE expenses ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE unit_labels ALTER COLUMN user_id SET NOT NULL;

-- 4. Enable Row Level Security
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_labels ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies — each user can only access their own rows
-- Properties
CREATE POLICY "Users can view own properties" ON properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own properties" ON properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own properties" ON properties FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own properties" ON properties FOR DELETE USING (auth.uid() = user_id);

-- Tenants
CREATE POLICY "Users can view own tenants" ON tenants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tenants" ON tenants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tenants" ON tenants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tenants" ON tenants FOR DELETE USING (auth.uid() = user_id);

-- Payments
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payments" ON payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payments" ON payments FOR DELETE USING (auth.uid() = user_id);

-- Expenses
CREATE POLICY "Users can view own expenses" ON expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON expenses FOR DELETE USING (auth.uid() = user_id);

-- Unit Labels
CREATE POLICY "Users can view own unit_labels" ON unit_labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own unit_labels" ON unit_labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own unit_labels" ON unit_labels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own unit_labels" ON unit_labels FOR DELETE USING (auth.uid() = user_id);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_unit_labels_user_id ON unit_labels(user_id);
