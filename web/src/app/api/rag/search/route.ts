/**
 * POST /api/rag/search
 *
 * Body: { query: string, k?: number, slice?: RagSlice | RagSlice[] }
 * Returns: { hits: RagHit[], durationMs: number, model: string, count: number }
 *
 * Used by the Gemma 4 31B twin engine to ground per-layer reasoning in
 * retrieved PubMed abstracts. Also callable directly from a future
 * clinician-facing "what's the evidence for X?" panel.
 */
import { ragSearch, loadIndex, type RagSlice } from "@/lib/rag";

const VALID_SLICES: RagSlice[] = [
  "clinical",
  "molecular",
  "structural",
  "microbiome",
  "longitudinal",
  "genomic",
  "equity",
];

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { query, k, slice } = (body ?? {}) as {
    query?: unknown;
    k?: unknown;
    slice?: unknown;
  };
  if (typeof query !== "string" || query.trim().length < 2) {
    return Response.json({ error: "query must be a non-empty string" }, { status: 400 });
  }
  let kNum: number | undefined;
  if (k !== undefined) {
    if (typeof k !== "number" || k < 1 || k > 25) {
      return Response.json({ error: "k must be 1–25" }, { status: 400 });
    }
    kNum = Math.floor(k);
  }
  let sliceArg: RagSlice | RagSlice[] | undefined;
  if (slice !== undefined) {
    const arr = Array.isArray(slice) ? slice : [slice];
    for (const s of arr) {
      if (typeof s !== "string" || !VALID_SLICES.includes(s as RagSlice)) {
        return Response.json(
          { error: `slice must be one of ${VALID_SLICES.join(", ")}` },
          { status: 400 },
        );
      }
    }
    sliceArg = (Array.isArray(slice) ? slice : [slice]) as RagSlice[];
    if (!Array.isArray(slice)) sliceArg = slice as RagSlice;
  }

  const t0 = Date.now();
  try {
    const hits = await ragSearch(query.trim(), { k: kNum, slice: sliceArg });
    const idx = loadIndex();
    return Response.json({
      hits,
      durationMs: Date.now() - t0,
      model: idx.model,
      count: idx.count,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const idx = loadIndex();
    const bySlice: Record<string, number> = {};
    for (const r of idx.rows) bySlice[r.slice] = (bySlice[r.slice] ?? 0) + 1;
    return Response.json({
      ok: true,
      model: idx.model,
      dim: idx.dim,
      count: idx.count,
      built_at: idx.built_at,
      bySlice,
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
