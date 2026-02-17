import { query } from '../client.js';

// ─── Types ───────────────────────────────────────────────────

export interface ContractEmbedding {
    id: string;
    contract_id: string;
    chunk_text: string;
    chunk_index: number;
    chunk_hash: string;
    created_at: string;
}

export interface EmbeddingInsert {
    contract_id: string;
    chunk_text: string;
    chunk_index: number;
    chunk_hash: string;
    embedding: number[];  // 768-dim float array
}

export interface SimilarityResult {
    id: string;
    contract_id: string;
    chunk_text: string;
    chunk_index: number;
    similarity_score: number;  // cosine similarity (1 = identical, 0 = orthogonal)
}

export interface EnrichedSearchResult extends SimilarityResult {
    contract_name: string;
    contract_type: string;
    risk_score: number | null;
}

// ─── Queries ─────────────────────────────────────────────────

/**
 * Insert a single embedding.
 * Uses ON CONFLICT to skip if chunk_hash already exists for this contract.
 */
export async function insertEmbedding(data: EmbeddingInsert): Promise<ContractEmbedding | null> {
    const vectorStr = `[${data.embedding.join(',')}]`;

    const result = await query<ContractEmbedding>(
        `INSERT INTO contract_embeddings (contract_id, chunk_text, chunk_index, chunk_hash, embedding)
     VALUES ($1, $2, $3, $4, $5::vector)
     ON CONFLICT (contract_id, chunk_hash) DO NOTHING
     RETURNING id, contract_id, chunk_text, chunk_index, chunk_hash, created_at`,
        [data.contract_id, data.chunk_text, data.chunk_index, data.chunk_hash, vectorStr],
    );

    return result.rows[0] ?? null;
}

/**
 * Batch insert embeddings (one query, skips duplicates via hash)
 */
export async function insertEmbeddingsBatch(embeddings: EmbeddingInsert[]): Promise<number> {
    if (embeddings.length === 0) return 0;

    const values: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const emb of embeddings) {
        const vectorStr = `[${emb.embedding.join(',')}]`;
        values.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}::vector)`,
        );
        params.push(
            emb.contract_id,
            emb.chunk_text,
            emb.chunk_index,
            emb.chunk_hash,
            vectorStr,
        );
        paramIndex += 5;
    }

    const result = await query(
        `INSERT INTO contract_embeddings (contract_id, chunk_text, chunk_index, chunk_hash, embedding)
     VALUES ${values.join(', ')}
     ON CONFLICT (contract_id, chunk_hash) DO NOTHING`,
        params,
    );

    return result.rowCount ?? 0;
}

/**
 * Semantic similarity search using pgvector cosine distance.
 * Scoped to a set of contract IDs (org-level filtering).
 *
 * Returns results ordered by similarity (highest first).
 *
 * @param queryEmbedding - 768-dim float array from Jina v2
 * @param contractIds    - List of contract IDs to search within (org scope)
 * @param limit          - Max number of results (default 10)
 */
export async function semanticSearch(
    queryEmbedding: number[],
    contractIds: string[],
    limit = 10,
): Promise<SimilarityResult[]> {
    if (contractIds.length === 0) return [];

    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const result = await query<SimilarityResult>(
        `SELECT
       ce.id,
       ce.contract_id,
       ce.chunk_text,
       ce.chunk_index,
       1 - (ce.embedding <=> $1::vector) AS similarity_score
     FROM contract_embeddings ce
     WHERE ce.contract_id = ANY($2::uuid[])
     ORDER BY ce.embedding <=> $1::vector
     LIMIT $3`,
        [vectorStr, contractIds, limit],
    );

    return result.rows;
}

/**
 * Semantic search with contract metadata enrichment.
 * Returns chunks joined with their contract's name, type, and risk score.
 */
export async function semanticSearchEnriched(
    queryEmbedding: number[],
    contractIds: string[],
    limit = 10,
): Promise<EnrichedSearchResult[]> {
    if (contractIds.length === 0) return [];

    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const result = await query<EnrichedSearchResult>(
        `SELECT
       ce.id,
       ce.contract_id,
       ce.chunk_text,
       ce.chunk_index,
       1 - (ce.embedding <=> $1::vector) AS similarity_score,
       c.name AS contract_name,
       c.type AS contract_type,
       c.risk_score
     FROM contract_embeddings ce
     JOIN contracts c ON ce.contract_id = c.id
     WHERE ce.contract_id = ANY($2::uuid[])
     ORDER BY ce.embedding <=> $1::vector
     LIMIT $3`,
        [vectorStr, contractIds, limit],
    );

    return result.rows;
}

/**
 * Check if embeddings exist for a contract (by chunk hash)
 */
export async function hasEmbeddings(contractId: string): Promise<boolean> {
    const result = await query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM contract_embeddings WHERE contract_id = $1) AS exists`,
        [contractId],
    );
    return result.rows[0]?.exists ?? false;
}

/**
 * Check which chunk hashes already exist for a contract.
 * Used to skip re-embedding unchanged chunks.
 */
export async function getExistingChunkHashes(contractId: string): Promise<Set<string>> {
    const result = await query<{ chunk_hash: string }>(
        `SELECT chunk_hash FROM contract_embeddings WHERE contract_id = $1`,
        [contractId],
    );
    return new Set(result.rows.map((r) => r.chunk_hash));
}

/**
 * Delete all embeddings for a contract (used before re-analysis)
 */
export async function deleteEmbeddingsByContractId(contractId: string): Promise<number> {
    const result = await query(
        `DELETE FROM contract_embeddings WHERE contract_id = $1`,
        [contractId],
    );
    return result.rowCount ?? 0;
}

/**
 * Get count of embeddings per contract (for health/debug)
 */
export async function countEmbeddingsForContract(contractId: string): Promise<number> {
    const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM contract_embeddings WHERE contract_id = $1`,
        [contractId],
    );
    return parseInt(result.rows[0]!.count, 10);
}
