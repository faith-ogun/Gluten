/**
 * PubMed RAG retrieval.
 *
 * Loads data/pubmed/index.json once per process, embeds the query via
 * Ollama (nomic-embed-text), and returns top-k cosine-similarity hits.
 * Optionally restricts to a single slice (e.g. "equity") when the twin
 * engine knows which layer it is reasoning about.
 *
 * The index is ~4 MB of floats; one read into memory at module load is
 * cheaper than any vector DB at hackathon scale (~500 rows).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { embed } from "./ollama";

export const EMBED_MODEL = process.env.EMBED_MODEL ?? "nomic-embed-text";

export type RagSlice =
  | "clinical"
  | "molecular"
  | "structural"
  | "microbiome"
  | "longitudinal"
  | "genomic"
  | "equity";

export type RagRow = {
  pmid: string;
  title: string;
  abstract: string;
  year: string;
  journal: string;
  mesh: string[];
  slice: RagSlice;
  vec: number[];
};

export type RagIndex = {
  model: string;
  dim: number;
  count: number;
  built_at: string;
  rows: RagRow[];
};

export type RagHit = Omit<RagRow, "vec"> & { score: number };

let _index: RagIndex | null = null;

/** Absolute path to the built index. Looks in repo-root/data/pubmed. */
function indexPath(): string {
  // Next.js runs with cwd = web/, so hop up one level.
  return resolve(process.cwd(), "..", "data", "pubmed", "index.json");
}

export function loadIndex(): RagIndex {
  if (_index) return _index;
  const p = indexPath();
  if (!existsSync(p)) {
    throw new Error(
      `PubMed RAG index not found at ${p}. Run: node scripts/fetch_pubmed.mjs && node scripts/embed_pubmed.mjs`,
    );
  }
  _index = JSON.parse(readFileSync(p, "utf8")) as RagIndex;
  return _index;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

export type RagSearchOptions = {
  k?: number;
  slice?: RagSlice | RagSlice[];
};

/**
 * Retrieve top-k abstracts for a natural-language query.
 *
 * Uses the `search_query:` prefix recommended by nomic-embed-text for the
 * query side (corpus used `search_document:`). The prefix pair materially
 * improves retrieval quality over plain text on both sides.
 */
export async function ragSearch(
  query: string,
  opts: RagSearchOptions = {},
): Promise<RagHit[]> {
  const k = opts.k ?? 5;
  const slices = opts.slice
    ? (Array.isArray(opts.slice) ? opts.slice : [opts.slice])
    : null;
  const idx = loadIndex();
  const { embeddings } = await embed({
    model: EMBED_MODEL,
    input: `search_query: ${query}`,
  });
  const qv = embeddings[0];
  const pool = slices ? idx.rows.filter((r) => slices.includes(r.slice)) : idx.rows;
  const scored: RagHit[] = pool.map((r) => {
    const { vec, ...rest } = r;
    return { ...rest, score: cosine(qv, vec) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
