-- ══════════════════════════════════════════════════════════════
-- Migration 004: Contract Embeddings (pgvector)
-- ══════════════════════════════════════════════════════════════

-- Enable pgvector extension (must be enabled on Supabase dashboard first)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE contract_embeddings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  -- Chunk data
  chunk_text      TEXT NOT NULL,
  chunk_index     INTEGER NOT NULL,       -- order within document
  chunk_hash      TEXT NOT NULL,           -- SHA256 hash for deduplication

  -- Embedding vector (Jina v2 = 768 dimensions)
  embedding       vector(768) NOT NULL,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────

-- HNSW index for Approximate Nearest Neighbor (ANN) similarity search
-- Using cosine distance operator (<=>)
-- m=16 (connections per layer), ef_construction=64 (build-time quality)
CREATE INDEX idx_embeddings_hnsw
  ON contract_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Cleanup + pre-filtering by contract_id
CREATE INDEX idx_embeddings_contract_id ON contract_embeddings(contract_id);

-- Deduplication: skip re-embedding if chunk hash already exists
CREATE UNIQUE INDEX idx_embeddings_chunk_hash ON contract_embeddings(contract_id, chunk_hash);
