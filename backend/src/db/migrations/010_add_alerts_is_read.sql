-- ══════════════════════════════════════════════════════════════
-- Migration 010: Add is_read column to alerts table
-- ══════════════════════════════════════════════════════════════
-- The application code references `is_read` (boolean) for read/unread
-- tracking, but the column was missing from the original schema.
-- ══════════════════════════════════════════════════════════════

-- Add the missing is_read column
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- Index for fast unread count queries
CREATE INDEX IF NOT EXISTS idx_alerts_unread
  ON alerts(org_id)
  WHERE is_read = false;
