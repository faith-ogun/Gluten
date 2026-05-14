#!/usr/bin/env node
/**
 * Pseudo-Marsh label generation for the IBDColEpi HE patches.
 *
 * Honest framing: IBDColEpi ships with epithelium segmentation masks but
 * NO Marsh / villous-atrophy / IEL annotations. Training a Marsh
 * classifier end-to-end therefore requires weak-supervision proxies.
 *
 * This script scores each HE patch by the paired label-mask coverage
 * (epithelium %) and bins the distribution into four quartile classes
 * that we label `Marsh-0`, `Marsh-1`, `Marsh-3a`, `Marsh-3b` for the
 * purposes of MedGemma fine-tuning. Marsh-2 is intentionally skipped
 * because GSE164883 (§8.1 molecular layer) notes Marsh-2 is under-
 * represented in the literature too.
 *
 * CRITICAL: these labels are proxies, not pathologist calls. The writeup
 * and the `/api/medgemma/marsh` endpoint must surface this caveat.
 *
 * Output: `data/structural/processed/marsh_pseudo_labels.csv` with one
 * row per HE patch: `image_path,label_path,epi_frac,marsh_bin,split`.
 *
 * This script does NOT open the zipped TIFFs — that is done on the
 * Kaggle notebook using `PIL` / `tifffile`. Here we only emit the
 * manifest row list so the Kaggle notebook can stream-read from the
 * attached Kaggle dataset mount path.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = resolve(ROOT, "data/structural/processed/patch_manifest.csv");
const OUT = resolve(ROOT, "data/structural/processed/marsh_pseudo_labels.csv");

const rows = readFileSync(MANIFEST, "utf8").trim().split("\n");
const header = rows.shift();
if (!header) throw new Error("empty manifest");

function parseCsv(line) {
  const cells = [];
  let i = 0;
  let cur = "";
  let inQ = false;
  while (i < line.length) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 2; continue; }
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

const hePatches = [];
for (const line of rows) {
  const c = parseCsv(line);
  if (c.length !== 11) continue;
  const [stain, split, wsi_id, , , , , , zip, image_path, label_path] = c;
  if (stain !== "HE") continue;
  hePatches.push({ wsi_id, split, zip, image_path, label_path });
}

console.log(`HE patches: ${hePatches.length}`);
console.log(`WSIs: ${new Set(hePatches.map((p) => p.wsi_id)).size}`);
console.log(`Splits:`, [...new Set(hePatches.map((p) => p.split))]);

// Emit the seed CSV. The Kaggle notebook fills in `epi_frac` and
// `marsh_bin` after opening each label mask; here we just write a
// placeholder so the schema is stable and the notebook is simple.
const out = ["image_path,label_path,split,wsi_id,epi_frac,marsh_bin"];
for (const p of hePatches) {
  out.push(`${p.image_path},${p.label_path},${p.split},${p.wsi_id},,`);
}
writeFileSync(OUT, out.join("\n") + "\n");
console.log(`wrote ${OUT}`);
