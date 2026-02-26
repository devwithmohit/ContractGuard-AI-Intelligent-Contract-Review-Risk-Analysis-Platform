-- ══════════════════════════════════════════════════════════════
-- Migration 008: Auto-create organization on user signup
-- ══════════════════════════════════════════════════════════════
-- This trigger fires AFTER a new row is inserted into auth.users.
-- It creates an organization + org_member (role=owner) for every
-- new signup so the user is immediately ready to use the app.
-- ══════════════════════════════════════════════════════════════

-- ─── Function ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  org_name   TEXT;
BEGIN
  -- Build a friendly org name from the user's display name or email
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  ) || '''s Organization';

  -- Create the organization
  INSERT INTO public.organizations (id, name, subscription_tier, created_at, updated_at)
  VALUES (gen_random_uuid(), org_name, 'free', NOW(), NOW())
  RETURNING id INTO new_org_id;

  -- Add the user as owner
  INSERT INTO public.org_members (org_id, user_id, role, joined_at)
  VALUES (new_org_id, NEW.id, 'owner', NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Trigger ─────────────────────────────────────────────────

-- Drop if it somehow already exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
