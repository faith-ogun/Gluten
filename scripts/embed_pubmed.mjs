#!/usr/bin/env node
/**
 * Embed every abstract in data/pubmed/raw/*.jsonl using a local Ollama
 * embedding model (default: nomic-embed-text, 768-dim) and write a single
 * flat index to data/pubmed/index.json.
 *
 * Flat JSON is fine at hackathon scale (~500 rows × 768 floats ≈ 3 MB).
 * Cosine similarity over 500 rows is microseconds; no vector DB needed.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = resolve(__dirname, "..", "data", "pubmed", "raw");
const OUT_PATH = resolve(__dirname, "..", "data", "pubmed", "index.json");

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = process.env.EMBED_MODEL ?? "nomic-embed-text";

async function embedBatch(inputs) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.embeddings;
}

const rows = [];
for (const f of readdirSync(RAW_DIR).sort()) {
  if (!f.endsWith(".jsonl")) continue;
  const text = readFileSync(resolve(RAW_DIR, f), "utf8").trim();
  for (const line of text.split("\n")) {
    if (!line) continue;
    rows.push(JSON.parse(line));
  }
}
console.log(`Loaded ${rows.length} abstracts from ${RAW_DIR}`);

// Embed title + abstract. Title carries strong topical signal, abstract the body.
// nomic-embed-text recommends the "search_document:" prefix for corpus side.
const texts = rows.map(r => `search_document: ${r.title}\n\n${r.abstract}`);

const BATCH = 16;
const vectors = [];
const t0 = Date.now();
for (let i = 0; i < texts.length; i += BATCH) {
  const batch = texts.slice(i, i + BATCH);
  const embs = await embedBatch(batch);
  vectors.push(...embs);
  if ((i / BATCH) % 5 === 0) {
    const pct = ((i + batch.length) / texts.length * 100).toFixed(1);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  embedded ${i + batch.length}/${texts.length} (${pct}%) — ${elapsed}s`);
  }
}
const dim = vectors[0]?.length ?? 0;
console.log(`Done: ${vectors.length} × ${dim}-d in ${((Date.now() - t0)/1000).toFixed(1)}s`);

const index = {
  model: MODEL,
  dim,
  count: vectors.length,
  built_at: new Date().toISOString(),
  rows: rows.map((r, i) => ({
    pmid: r.pmid,
    title: r.title,
    abstract: r.abstract,
    year: r.year,
    journal: r.journal,
    mesh: r.mesh,
    slice: r.slice,
    vec: vectors[i],
  })),
};
writeFileSync(OUT_PATH, JSON.stringify(index));
console.log(`Wrote ${OUT_PATH} (${(JSON.stringify(index).length / 1024 / 1024).toFixed(2)} MB)`);
