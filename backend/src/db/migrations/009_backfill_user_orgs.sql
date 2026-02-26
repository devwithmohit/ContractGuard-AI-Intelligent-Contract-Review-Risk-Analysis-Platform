-- ══════════════════════════════════════════════════════════════
-- Backfill: create organizations for existing users without one
-- ══════════════════════════════════════════════════════════════
-- Finds all users in auth.users who are NOT in org_members,
-- creates an org for each, and adds them as owner.
-- Safe & idempotent — skips users who already have an org.
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  new_org_id UUID;
  org_name   TEXT;
  cnt        INT := 0;
BEGIN
  FOR r IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.org_members om ON om.user_id = u.id
    WHERE om.user_id IS NULL
  LOOP
    -- Build org name
    org_name := COALESCE(
      r.raw_user_meta_data->>'full_name',
      split_part(r.email, '@', 1)
    ) || '''s Organization';

    -- Create org
    INSERT INTO public.organizations (id, name, subscription_tier, created_at, updated_at)
    VALUES (gen_random_uuid(), org_name, 'free', NOW(), NOW())
    RETURNING id INTO new_org_id;

    -- Add user as owner
    INSERT INTO public.org_members (org_id, user_id, role, joined_at)
    VALUES (new_org_id, r.id, 'owner', NOW());

    cnt := cnt + 1;
    RAISE NOTICE 'Created org % for user % (%)', new_org_id, r.id, r.email;
  END LOOP;

  RAISE NOTICE 'Backfill complete — % users processed', cnt;
END;
$$;
