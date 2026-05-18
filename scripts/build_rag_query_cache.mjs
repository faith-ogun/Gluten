/**
 * Pre-embed the RAG query strings the twin engine fires per call.
 * Output: web/public/pubmed/query-cache.json — a flat map of
 *   { "<query string>": [number, number, ...] }
 * Run locally with Ollama + nomic-embed-text pulled:
 *   node scripts/build_rag_query_cache.mjs
 */

import fs from "node:fs";
import path from "node:path";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = "nomic-embed-text";

const DEMO = {
  age: 27, sex: "female", ancestry: "african",
  hla: "dq2.5", marsh: "3b", tTG: 92, gfdMonths: 0,
};

const VARIANTS = [
  DEMO,
  { ...DEMO, gfdMonths: 6, marsh: "1", tTG: 14 },
  { ...DEMO, ancestry: "european" },
  { ...DEMO, ancestry: "south_asian" },
  { age: 35, sex: "male" },
];

function buildLayerQuery(p, id) {
  const demo = [
    p.age ? `age ${p.age}` : "",
    p.sex ?? "",
    p.ancestry && p.ancestry !== "unknown" ? p.ancestry : "",
  ].filter(Boolean).join(" ");
  const marsh = p.marsh ? `Marsh ${p.marsh}` : "";
  const gfd = p.gfdMonths !== undefined
    ? p.gfdMonths > 0 ? `${p.gfdMonths} months gluten-free diet` : "newly diagnosed pre-GFD"
    : "";
  const serology = p.tTG !== undefined ? `tTG-IgA ${p.tTG}` : "";
  const hla = p.hla && p.hla !== "unknown" && p.hla !== "negative" ? `HLA-${p.hla.toUpperCase()}` : "";
  switch (id) {
    case "clinical":     return `coeliac disease diagnosis serology ${serology} ${marsh} ${gfd} ${demo}`.trim();
    case "molecular":    return `coeliac disease duodenal transcriptome immune checkpoint gene expression ${marsh} ${demo}`.trim();
    case "structural":   return `coeliac disease duodenal biopsy histopathology villous atrophy IEL ${marsh} ${demo}`.trim();
    case "microbiome":   return `coeliac disease gut microbiome metaproteome gluten-free diet ${gfd} ${demo}`.trim();
    case "longitudinal": return `coeliac disease T cell receptor HLA-DQ2 gluten-reactive tetramer ${hla} ${demo}`.trim();
    case "genomic":      return `coeliac disease polygenic risk HLA-DQ2 DQ8 GWAS SNP ${hla} ${demo}`.trim();
  }
}
function buildEquityQuery(p) {
  const anc = p.ancestry && p.ancestry !== "unknown" ? p.ancestry : "underserved population";
  return `coeliac disease ${anc} diagnostic delay false negative serology underdiagnosis`;
}

const LAYERS = ["clinical", "molecular", "structural", "microbiome", "longitudinal", "genomic"];
const queries = new Set();
for (const p of VARIANTS) {
  for (const l of LAYERS) queries.add(buildLayerQuery(p, l));
  queries.add(buildEquityQuery(p));
}

async function embed(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: `search_query: ${text}` }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.embeddings[0];
}

console.log(`Pre-embedding ${queries.size} unique query strings...`);
const cache = {};
let i = 0;
for (const q of queries) {
  i++;
  process.stdout.write(`  [${i}/${queries.size}] ${q.slice(0, 60)}...`);
  cache[q] = await embed(q);
  process.stdout.write(` ✓ (dim ${cache[q].length})\n`);
}

const outPath = path.resolve(process.cwd(), "web", "public", "pubmed", "query-cache.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(cache));
console.log(`\nWrote ${Object.keys(cache).length} embeddings to ${outPath}`);
console.log(`Size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
