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

/**
 * Resolve the on-disk path to the built PubMed RAG index.
 *
 * Production (Firebase App Hosting): the index ships inside the deployed
 * bundle at `web/public/pubmed/index.json`. process.cwd() inside the
 * Cloud Run container is the standalone server root (sibling to `public/`),
 * so we read it at `./public/pubmed/index.json`.
 *
 * Local dev: same path works because `next dev` runs from `web/`.
 *
 * Fallback: the legacy repo-root location `../data/pubmed/index.json`
 * still works if someone runs from a checkout that has the data tree
 * but hasn't copied the index into public/.
 */
function indexPath(): string {
  const candidates = [
    resolve(process.cwd(), "public", "pubmed", "index.json"),
    resolve(process.cwd(), ".next", "standalone", "public", "pubmed", "index.json"),
    resolve(process.cwd(), "..", "data", "pubmed", "index.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
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
/**
 * Retrieve top-k abstracts for a natural-language query.
 *
 * Uses pre-computed query embeddings from `web/public/pubmed/query-cache.json`.
 * Queries are deterministic per layer (built from `formatLayerQuery` in
 * `twin.ts`), so we hash the exact query string and look it up. The cache
 * was generated locally against nomic-embed-text and shipped with the
 * deployed bundle. Ollama Cloud doesn't host nomic-embed-text, so this
 * avoids a runtime embedding call entirely.
 */
type QueryCache = Record<string, number[]>;
let _qcache: QueryCache | null = null;

function queryCachePath(): string {
  const candidates = [
    resolve(process.cwd(), "public", "pubmed", "query-cache.json"),
    resolve(process.cwd(), ".next", "standalone", "public", "pubmed", "query-cache.json"),
    resolve(process.cwd(), "..", "data", "pubmed", "query-cache.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

function loadQueryCache(): QueryCache {
  if (_qcache) return _qcache;
  const p = queryCachePath();
  if (!existsSync(p)) {
    _qcache = {};
    return _qcache;
  }
  _qcache = JSON.parse(readFileSync(p, "utf8")) as QueryCache;
  return _qcache;
}

export async function ragSearch(
  query: string,
  opts: RagSearchOptions = {},
): Promise<RagHit[]> {
  const k = opts.k ?? 5;
  const slices = opts.slice
    ? (Array.isArray(opts.slice) ? opts.slice : [opts.slice])
    : null;
  const idx = loadIndex();
  const pool = slices ? idx.rows.filter((r) => slices.includes(r.slice)) : idx.rows;

  // Try the cache first.
  const cache = loadQueryCache();
  const cached = cache[query];
  let qv: number[] | null = cached ?? null;

  if (!qv) {
    // Cache miss — fall back to live embedding via Ollama. Works locally
    // (nomic-embed-text pulled), throws on Ollama Cloud (model not hosted),
    // in which case the caller sees a 401 — easy signal that the cache
    // needs to be regenerated for that query.
    const { embeddings } = await embed({
      model: EMBED_MODEL,
      input: `search_query: ${query}`,
    });
    qv = embeddings[0];
  }

  const scored: RagHit[] = pool.map((r) => {
    const { vec, ...rest } = r;
    return { ...rest, score: cosine(qv as number[], vec) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
