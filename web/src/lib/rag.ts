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
