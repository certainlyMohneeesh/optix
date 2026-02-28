-- ─────────────────────────────────────────────────────────────────────────────
--  OPTIX — Supabase PostgreSQL Schema
--  Run this in the Supabase SQL Editor (once per project)
-- ─────────────────────────────────────────────────────────────────────────────

-- Option chain snapshots table
CREATE TABLE IF NOT EXISTS option_chain_snapshots (
  id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    timestamptz  DEFAULT now() NOT NULL,
  broker        text         NOT NULL,          -- 'upstox' | 'zerodha'
  symbol        text         NOT NULL,          -- 'NIFTY' | 'BANKNIFTY' etc.
  expiry        text         NOT NULL,          -- '27-Feb-2026'
  spot          numeric      NOT NULL,          -- underlying LTP
  chain_data    jsonb        NOT NULL,          -- ChainRow[] serialized
  pcr           numeric,                        -- put-call ratio
  max_pain      integer,                        -- max-pain strike
  total_call_oi bigint,
  total_put_oi  bigint,
  vol_pcr       numeric                         -- volume-based PCR
);

-- Fast look-up for recent snapshots by symbol + expiry
CREATE INDEX IF NOT EXISTS idx_snapshots_symbol_expiry
  ON option_chain_snapshots (symbol, expiry, created_at DESC);

-- Row-Level Security  (allow anon read + insert via public API key)
ALTER TABLE option_chain_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select"
  ON option_chain_snapshots
  FOR SELECT
  USING (true);

CREATE POLICY "Allow anon insert"
  ON option_chain_snapshots
  FOR INSERT
  WITH CHECK (true);
