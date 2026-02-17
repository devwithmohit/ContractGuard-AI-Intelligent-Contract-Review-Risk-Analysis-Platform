-- ══════════════════════════════════════════════════════════════
-- Migration 003: Contract Clauses
-- ══════════════════════════════════════════════════════════════

CREATE TABLE contract_clauses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  -- Clause data
  clause_type     TEXT NOT NULL
                  CHECK (clause_type IN (
                    'liability', 'indemnification', 'data_processing',
                    'auto_renewal', 'termination', 'payment',
                    'confidentiality', 'ip_ownership', 'warranty',
                    'force_majeure', 'governing_law', 'dispute_resolution',
                    'non_compete', 'non_solicitation', 'other'
                  )),
  text            TEXT NOT NULL,
  page_number     INTEGER,

  -- Risk assessment
  risk_level      TEXT NOT NULL DEFAULT 'low'
                  CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  risk_explanation TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────

-- Clause lookup per contract (primary access pattern)
CREATE INDEX idx_clauses_contract_id ON contract_clauses(contract_id);

-- Filtered clause views (e.g. "show all critical liability clauses")
CREATE INDEX idx_clauses_type_risk ON contract_clauses(clause_type, risk_level);

-- Risk level filtering across all clauses
CREATE INDEX idx_clauses_risk_level ON contract_clauses(risk_level);
