-- ══════════════════════════════════════════════════════════════
-- Migration 005: Alerts
-- ══════════════════════════════════════════════════════════════

CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  -- Alert data
  alert_type      TEXT NOT NULL
                  CHECK (alert_type IN ('renewal', 'expiration', 'compliance', 'risk_critical')),
  message         TEXT NOT NULL,
  trigger_date    DATE NOT NULL,

  -- Status management
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'snoozed', 'dismissed')),
  snoozed_until   DATE,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────

-- Daily alert check: find pending alerts due today or earlier
CREATE INDEX idx_alerts_trigger_pending
  ON alerts(trigger_date)
  WHERE status = 'pending';

-- Org-scoped alert listing
CREATE INDEX idx_alerts_org_id ON alerts(org_id);

-- Contract-scoped alerts (show on contract detail page)
CREATE INDEX idx_alerts_contract_id ON alerts(contract_id);

-- Prevent duplicate alerts for same contract + type + date
CREATE UNIQUE INDEX idx_alerts_unique_trigger
  ON alerts(contract_id, alert_type, trigger_date);

-- ─── Updated_at trigger ──────────────────────────────────────
CREATE TRIGGER trg_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
