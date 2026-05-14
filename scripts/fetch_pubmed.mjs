#!/usr/bin/env node
/**
 * PubMed corpus fetcher for the Glüten RAG pipeline.
 *
 * Uses NCBI E-utilities (esearch → efetch) to pull abstracts for each of the
 * seven slices defined below, dedupes by PMID across slices, and writes one
 * JSONL per slice under data/pubmed/raw/.
 *
 * Every query includes BOTH spellings ("celiac" OR "coeliac") — the British
 * spelling is surfaced in UK/Irish/European journals that often don't index
 * the American one.
 *
 * No API key (free tier: 3 req/s). Date filter 2015–2026.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "data", "pubmed", "raw");
mkdirSync(OUT_DIR, { recursive: true });

const CD = '("celiac disease"[Title/Abstract] OR "coeliac disease"[Title/Abstract] OR "celiac"[Title/Abstract] OR "coeliac"[Title/Abstract])';
const DATE = 'AND ("2015"[Date - Publication] : "2026"[Date - Publication])';
const LANG = 'AND English[Language]';
const EXCL = 'NOT "case reports"[Publication Type]';

/** @type {{slice: string, target: number, query: string}[]} */
const SLICES = [
  {
    slice: "clinical",
    target: 70,
    query: `${CD} AND (tTG OR "tissue transglutaminase" OR EMA OR "endomysial" OR "deamidated gliadin" OR "gluten-free diet" OR Marsh OR "villous atrophy" OR serology) ${DATE} ${LANG} ${EXCL}`,
  },
  {
    slice: "molecular",
    target: 50,
    query: `${CD} AND (transcriptom* OR "gene expression" OR "RNA-seq" OR "single-cell" OR "immune checkpoint" OR BTLA OR LAG3 OR CTLA4 OR PDCD1) ${DATE} ${LANG} ${EXCL}`,
  },
  {
    slice: "structural",
    target: 55,
    query: `${CD} AND ("deep learning" OR "machine learning" OR histopath* OR "intraepithelial lymphocyte" OR IEL OR segmentation OR "digital pathology" OR "whole slide") ${DATE} ${LANG} ${EXCL}`,
  },
  {
    slice: "microbiome",
    target: 50,
    query: `${CD} AND (microbiom* OR microbiota OR metaproteom* OR metagenom* OR dysbiosis OR "gut flora") ${DATE} ${LANG} ${EXCL}`,
  },
  {
    slice: "longitudinal",
    target: 50,
    query: `${CD} AND ("T cell receptor" OR TCR OR tetramer OR "HLA-DQ2" OR "HLA-DQ8" OR "gluten-reactive" OR "gliadin-specific") ${DATE} ${LANG} ${EXCL}`,
  },
  {
    slice: "genomic",
    target: 50,
    query: `${CD} AND (GWAS OR "polygenic risk" OR "genetic risk score" OR SNP OR "genome-wide" OR heritab* OR genotyp*) ${DATE} ${LANG} ${EXCL}`,
  },
  {
    slice: "equity",
    target: 70,
    query: `${CD} AND (Africa* OR "African American" OR Asia* OR Hispanic OR Latin* OR ethnic* OR racial OR disparit* OR underdiagnos* OR "under-diagnosed" OR "false negative" OR underserved OR minority) ${DATE} ${LANG} ${EXCL}`,
  },
];

const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

async function esearch(query, retmax) {
  const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("term", query);
  url.searchParams.set("retmax", String(retmax));
  url.searchParams.set("retmode", "json");
  url.searchParams.set("sort", "relevance");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`esearch ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.esearchresult?.idlist ?? [];
}

async function efetch(pmids) {
  if (pmids.length === 0) return "";
  const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", pmids.join(","));
  url.searchParams.set("rettype", "abstract");
  url.searchParams.set("retmode", "xml");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`efetch ${res.status}: ${await res.text()}`);
  return res.text();
}

/**
 * Minimal XML parser for PubmedArticle entries. Avoids adding a dep —
 * PubMed's XML is shallow enough that tag-level regex suffices for
 * {pmid, title, abstract, year, journal, mesh}.
 */
function parsePubmedXml(xml) {
  const articles = [];
  const artMatches = xml.split(/<PubmedArticle[>\s]/).slice(1);
  for (const chunk of artMatches) {
    const pmid = (chunk.match(/<PMID[^>]*>(\d+)<\/PMID>/) ?? [])[1];
    const title = decodeXml((chunk.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/) ?? [])[1] ?? "").trim();
    // Abstract can be split across multiple AbstractText elements (BACKGROUND / METHODS / etc.)
    const absParts = [...chunk.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map(m => decodeXml(m[1]));
    const abstract = absParts.join(" ").replace(/\s+/g, " ").trim();
    const year = (chunk.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/) ?? [])[1]
             ?? (chunk.match(/<PubDate>[\s\S]*?<MedlineDate>(\d{4})/) ?? [])[1]
             ?? "";
    const journal = decodeXml((chunk.match(/<Title>([\s\S]*?)<\/Title>/) ?? [])[1] ?? "").trim();
    const mesh = [...chunk.matchAll(/<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/g)].map(m => decodeXml(m[1]).trim());
    if (!pmid || !abstract) continue;
    articles.push({ pmid, title, abstract, year, journal, mesh });
  }
  return articles;
}

function decodeXml(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
}

const seen = new Set();
const summary = {};

for (const { slice, target, query } of SLICES) {
  const outPath = resolve(OUT_DIR, `${slice}.jsonl`);
  if (existsSync(outPath)) {
    const rows = readFileSync(outPath, "utf8").trim().split("\n").filter(Boolean);
    for (const r of rows) { try { seen.add(JSON.parse(r).pmid); } catch {} }
    summary[slice] = { cached: true, count: rows.length };
    console.log(`[${slice}] cached ${rows.length} — skipping fetch`);
    continue;
  }

  console.log(`[${slice}] esearch (target ${target})`);
  // Over-pull by ~40% to survive dedupe + no-abstract filter
  const pmids = await esearch(query, Math.round(target * 1.5));
  await SLEEP(350);
  const fresh = pmids.filter(p => !seen.has(p));
  console.log(`[${slice}] got ${pmids.length} ids, ${fresh.length} after cross-slice dedupe`);

  // Fetch in chunks of 100 to stay within efetch URL limits
  const rows = [];
  for (let i = 0; i < fresh.length; i += 100) {
    const chunk = fresh.slice(i, i + 100);
    const xml = await efetch(chunk);
    const parsed = parsePubmedXml(xml);
    for (const a of parsed) {
      if (seen.has(a.pmid)) continue;
      seen.add(a.pmid);
      rows.push({ ...a, slice });
    }
    await SLEEP(350);
  }
  // Trim to target
  const trimmed = rows.slice(0, target);
  writeFileSync(outPath, trimmed.map(r => JSON.stringify(r)).join("\n") + "\n");
  summary[slice] = { fetched: true, kept: trimmed.length, requested: target };
  console.log(`[${slice}] wrote ${trimmed.length} → ${outPath}`);
}

console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(summary, null, 2));
console.log(`Total unique PMIDs across corpus: ${seen.size}`);
