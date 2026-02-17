-- ══════════════════════════════════════════════════════════════
-- Migration 006: AI Usage Tracking
-- ══════════════════════════════════════════════════════════════

CREATE TABLE ai_usage (
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  tokens_used     BIGINT NOT NULL DEFAULT 0,
  cost_usd        DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
  api_calls       INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (org_id, date)
);

-- ─── Indexes ─────────────────────────────────────────────────

-- Query usage by org over date range (billing reports)
CREATE INDEX idx_ai_usage_org_date ON ai_usage(org_id, date DESC);

-- ─── Upsert Helper Function ─────────────────────────────────
-- Atomically increment usage counters (called after each AI API call)
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_org_id UUID,
  p_tokens BIGINT,
  p_cost DECIMAL(10, 4),
  p_calls INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
  INSERT INTO ai_usage (org_id, date, tokens_used, cost_usd, api_calls)
  VALUES (p_org_id, CURRENT_DATE, p_tokens, p_cost, p_calls)
  ON CONFLICT (org_id, date)
  DO UPDATE SET
    tokens_used = ai_usage.tokens_used + EXCLUDED.tokens_used,
    cost_usd    = ai_usage.cost_usd + EXCLUDED.cost_usd,
    api_calls   = ai_usage.api_calls + EXCLUDED.api_calls;
END;
$$ LANGUAGE plpgsql;
