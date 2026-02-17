-- ══════════════════════════════════════════════════════════════
-- Migration 002: Contracts
-- ══════════════════════════════════════════════════════════════

CREATE TABLE contracts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by       UUID NOT NULL REFERENCES auth.users(id),
  name              TEXT NOT NULL,
  type              TEXT NOT NULL
                    CHECK (type IN ('NDA', 'MSA', 'SaaS', 'Vendor', 'Employment', 'Other')),
  counterparty      TEXT,
  status            TEXT NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'active', 'error', 'archived')),

  -- File metadata
  file_path         TEXT NOT NULL,
  file_size         INTEGER NOT NULL,     -- bytes
  file_type         TEXT NOT NULL,        -- 'pdf' or 'docx'

  -- Extracted / computed data
  raw_text          TEXT,
  effective_date    DATE,
  expiration_date   DATE,
  auto_renewal      BOOLEAN DEFAULT FALSE,
  risk_score        INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  summary           TEXT,

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_analyzed_at  TIMESTAMPTZ
);

-- ─── Indexes ─────────────────────────────────────────────────

-- Multi-tenant isolation: all queries filter by org_id
CREATE INDEX idx_contracts_org_id ON contracts(org_id);

-- Filter by processing status
CREATE INDEX idx_contracts_status ON contracts(status);

-- Renewal alert queries: only care about non-null expiration dates
CREATE INDEX idx_contracts_expiration_date
  ON contracts(expiration_date)
  WHERE expiration_date IS NOT NULL;

-- Sort by risk score for dashboard
CREATE INDEX idx_contracts_risk_score ON contracts(risk_score);

-- Full-text search on name + counterparty
CREATE INDEX idx_contracts_search
  ON contracts
  USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(counterparty, '')));

-- Composite: org + status (most common query pattern)
CREATE INDEX idx_contracts_org_status ON contracts(org_id, status);

-- ─── Updated_at trigger ──────────────────────────────────────
CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
