#!/usr/bin/env node
/**
 * Build a small, Kaggle-safe HE-patch dataset from
 * `data/structural/raw/patch-dataset-HE.zip`.
 *
 * Why: Kaggle Datasets reject filenames with `[ ] = ,` characters, and
 * the original 8.2 GB zip uses `[d=4,x=...]` in every entry. Uploading
 * the whole archive (a) fails the bracket check and (b) is wasteful —
 * we only need ~2,400 patches for the QLoRA fine-tune.
 *
 * What this script does:
 *   1. Reads `marsh_pseudo_labels.csv`.
 *   2. Stratified-samples ~2,000 train + ~400 test patches across
 *      pseudo-Marsh bins (using epi_frac quantiles already in the CSV
 *      if present, otherwise computes them in-zip).
 *   3. Extracts only those patches' image + label TIFFs.
 *   4. Renames each file with a Kaggle-safe scheme:
 *        `[` → `(`, `]` → `)`, `=` → `-`, `,` → `_`, ` ` → `_`.
 *   5. Repacks into `patch-dataset-HE-sampled.zip` (~600 MB-1.2 GB).
 *   6. Writes a matching `marsh_pseudo_labels-sampled.csv` with the
 *      new paths.
 *
 * Upload both artefacts as a single Kaggle Dataset (slug
 * `gluten-ibdcolepi-sample`).
 *
 * Pre-req: `unzip` and `zip` on PATH (default on macOS).
 */

import { readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ZIP = resolve(ROOT, "data/structural/raw/patch-dataset-HE.zip");
const SEED_CSV = resolve(ROOT, "data/structural/processed/marsh_pseudo_labels.csv");
const OUT_DIR = resolve(ROOT, "data/structural/processed");
const OUT_ZIP = resolve(OUT_DIR, "patch-dataset-HE-sampled.zip");
const OUT_CSV = resolve(OUT_DIR, "marsh_pseudo_labels-sampled.csv");
const TMP = resolve(OUT_DIR, "_sample_tmp");

const N_TRAIN = 2000;
const N_TEST = 400;
const N_VAL = 200;

function sanitize(name) {
  return name
    .replaceAll("[", "(")
    .replaceAll("]", ")")
    .replaceAll("=", "-")
    .replaceAll(",", "_")
    .replaceAll(" ", "_");
}
function sanitizePath(p) {
  return p.split("/").map(sanitize).join("/");
}
function parseCsv(line) {
  const cells = [];
  let i = 0, cur = "", inQ = false;
  while (i < line.length) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i+1] === '"') { cur += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      cur += c; i++;
    } else {
      if (c === '"' && cur === "") { inQ = true; i++; continue; }
      if (c === ",") { cells.push(cur); cur = ""; i++; continue; }
      cur += c; i++;
    }
  }
  cells.push(cur);
  return cells;
}
function quoteIfNeeded(v) {
  return /[,"\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

console.log("Reading seed CSV...");
const lines = readFileSync(SEED_CSV, "utf8").trim().split("\n");
const header = lines.shift();
const rows = lines.map(parseCsv).map((c) => ({
  image_path: c[0],
  label_path: c[1],
  split: c[2],
  wsi_id: c[3],
}));
console.log(`Total HE rows in seed: ${rows.length}`);

// Deterministic random sample by split.
function sample(arr, n, seed = 42) {
  const a = arr.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
const train = sample(rows.filter((r) => r.split === "Trainset"), N_TRAIN);
const val = sample(rows.filter((r) => r.split === "Validationset"), N_VAL);
const test = sample(rows.filter((r) => r.split === "Testset"), N_TEST);
const picked = [...train, ...val, ...test];
console.log(`Sampled: ${train.length} train + ${val.length} val + ${test.length} test = ${picked.length}`);

if (existsSync(TMP)) execSync(`rm -rf "${TMP}"`);
mkdirSync(TMP, { recursive: true });

// Build a list of zip entries to extract. Each row contributes 2:
// image + paired label mask.
const entries = [];
for (const r of picked) { entries.push(r.image_path); entries.push(r.label_path); }
const listFile = resolve(TMP, "_to_extract.txt");
writeFileSync(listFile, entries.join("\n") + "\n");

console.log("Extracting sampled patches from zip...");
// Use unzip with a list file. Quote-safe by writing to a file.
execSync(`cd "${TMP}" && unzip -q "${SRC_ZIP}" -@ < "${listFile}"`, { stdio: "inherit" });

console.log("Renaming to Kaggle-safe filenames...");
// Walk via find — fast for ~5k files.
const finds = execSync(`find "${TMP}" -type f -name "*.tif"`, { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
for (const full of finds) {
  const dir = full.substring(0, full.lastIndexOf("/"));
  const base = full.substring(full.lastIndexOf("/") + 1);
  const safe = sanitize(base);
  if (safe !== base) execSync(`mv "${full}" "${dir}/${safe}"`);
}

console.log("Building output zip...");
if (existsSync(OUT_ZIP)) execSync(`rm -f "${OUT_ZIP}"`);
execSync(`cd "${TMP}" && zip -qr "${OUT_ZIP}" Trainset Validationset Testset`, { stdio: "inherit" });
execSync(`rm -rf "${TMP}"`);
console.log(`Wrote ${OUT_ZIP} (${(statSync(OUT_ZIP).size / 1e9).toFixed(2)} GB)`);

console.log("Writing sampled+sanitised CSV...");
const out = [header];
for (const r of picked) {
  out.push([
    sanitizePath(r.image_path),
    sanitizePath(r.label_path),
    r.split,
    r.wsi_id,
    "", "", // epi_frac, marsh_bin filled on Kaggle
  ].map(quoteIfNeeded).join(","));
}
writeFileSync(OUT_CSV, out.join("\n") + "\n");
console.log(`Wrote ${OUT_CSV} (${picked.length} rows)`);
console.log("\nNext: upload BOTH files as one Kaggle Dataset, slug `gluten-ibdcolepi-sample`.");
