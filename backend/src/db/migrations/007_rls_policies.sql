-- ══════════════════════════════════════════════════════════════
-- Migration 007: Row Level Security (RLS) Policies
-- ══════════════════════════════════════════════════════════════

-- ─── Enable RLS on all tables ────────────────────────────────
ALTER TABLE organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_clauses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage            ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════
-- ORGANIZATIONS
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "org_read_own"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_update_admin"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );


-- ══════════════════════════════════════════════════════════════
-- ORG_MEMBERS
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "members_read_same_org"
  ON org_members FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "members_insert_admin"
  ON org_members FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "members_delete_admin"
  ON org_members FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );


-- ══════════════════════════════════════════════════════════════
-- CONTRACTS
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "org_read_contracts"
  ON contracts FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_insert_contracts"
  ON contracts FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_update_contracts"
  ON contracts FOR UPDATE
  USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "admin_delete_contracts"
  ON contracts FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );


-- ══════════════════════════════════════════════════════════════
-- CONTRACT_CLAUSES (inherit access through contracts)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "org_read_clauses"
  ON contract_clauses FOR SELECT
  USING (
    contract_id IN (
      SELECT id FROM contracts
      WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "org_insert_clauses"
  ON contract_clauses FOR INSERT
  WITH CHECK (
    contract_id IN (
      SELECT id FROM contracts
      WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "org_delete_clauses"
  ON contract_clauses FOR DELETE
  USING (
    contract_id IN (
      SELECT id FROM contracts
      WHERE org_id IN (
        SELECT org_id FROM org_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );


-- ══════════════════════════════════════════════════════════════
-- CONTRACT_EMBEDDINGS (inherit access through contracts)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "org_read_embeddings"
  ON contract_embeddings FOR SELECT
  USING (
    contract_id IN (
      SELECT id FROM contracts
      WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "org_insert_embeddings"
  ON contract_embeddings FOR INSERT
  WITH CHECK (
    contract_id IN (
      SELECT id FROM contracts
      WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "org_delete_embeddings"
  ON contract_embeddings FOR DELETE
  USING (
    contract_id IN (
      SELECT id FROM contracts
      WHERE org_id IN (
        SELECT org_id FROM org_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );


-- ══════════════════════════════════════════════════════════════
-- ALERTS
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "org_read_alerts"
  ON alerts FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_update_alerts"
  ON alerts FOR UPDATE
  USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_insert_alerts"
  ON alerts FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );


-- ══════════════════════════════════════════════════════════════
-- AI_USAGE
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "org_read_ai_usage"
  ON ai_usage FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );


-- ══════════════════════════════════════════════════════════════
-- SUPABASE STORAGE: Signed URLs only (no direct bucket access)
-- Objects prefixed by org_id: "org_uuid/contract_uuid.pdf"
-- ══════════════════════════════════════════════════════════════

-- NOTE: This policy should be created via Supabase Dashboard or
-- after the storage.objects table exists in your Supabase project.
-- Included here for reference:
--
-- CREATE POLICY "org_storage_access"
--   ON storage.objects FOR SELECT
--   USING (
--     (storage.foldername(name))[1] IN (
--       SELECT org_id::text FROM org_members WHERE user_id = auth.uid()
--     )
--   );
