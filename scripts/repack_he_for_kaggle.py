#!/usr/bin/env python3
"""
Build a small, Kaggle-safe HE-patch dataset from
`data/structural/raw/patch-dataset-HE.zip`.

Why: Kaggle Datasets reject filenames with `[ ] = ,` characters, and
the original 8.2 GB zip uses `[d=4,x=...]` in every entry. Uploading
the whole archive (a) fails the bracket check and (b) is wasteful —
we only need ~2,400 patches for the QLoRA fine-tune.

Output:
    data/structural/processed/patch-dataset-HE-sampled.zip
    data/structural/processed/marsh_pseudo_labels-sampled.csv

Upload BOTH as a single Kaggle Dataset (slug `gluten-ibdcolepi-sample`).
"""

import csv, random, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_ZIP = ROOT / "data/structural/raw/patch-dataset-HE.zip"
SEED_CSV = ROOT / "data/structural/processed/marsh_pseudo_labels.csv"
OUT_DIR = ROOT / "data/structural/processed"
OUT_ZIP = OUT_DIR / "patch-dataset-HE-sampled.zip"
OUT_CSV = OUT_DIR / "marsh_pseudo_labels-sampled.csv"

N_TRAIN, N_VAL, N_TEST = 2000, 200, 400
random.seed(42)


def sanitize(name: str) -> str:
    return (name.replace("[", "(").replace("]", ")")
                .replace("=", "-").replace(",", "_").replace(" ", "_"))


def sanitize_path(p: str) -> str:
    return "/".join(sanitize(s) for s in p.split("/"))


# Re-parse the original patch_manifest.csv directly — it's the
# authoritative list and has consistent quoting.
MANIFEST = ROOT / "data/structural/processed/patch_manifest.csv"
print(f"Reading {MANIFEST} ...")
he_rows = []
with open(MANIFEST, newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row["stain"] != "HE":
            continue
        he_rows.append({
            "image_path": row["image_path"],
            "label_path": row["label_path"],
            "split": row["split"],
            "wsi_id": row["wsi_id"],
        })
print(f"HE rows: {len(he_rows)}")

by_split = {"Trainset": [], "Validationset": [], "Testset": []}
for r in he_rows:
    by_split.setdefault(r["split"], []).append(r)

picked = (
    random.sample(by_split["Trainset"], min(N_TRAIN, len(by_split["Trainset"])))
    + random.sample(by_split["Validationset"], min(N_VAL, len(by_split["Validationset"])))
    + random.sample(by_split["Testset"], min(N_TEST, len(by_split["Testset"])))
)
print(f"Picked {len(picked)} patches "
      f"({sum(1 for r in picked if r['split']=='Trainset')} train / "
      f"{sum(1 for r in picked if r['split']=='Validationset')} val / "
      f"{sum(1 for r in picked if r['split']=='Testset')} test)")

# Stream from source zip, write to output zip, renaming on the fly.
print(f"Streaming patches into {OUT_ZIP.name} ...")
OUT_ZIP.unlink(missing_ok=True)
n_written = 0
with zipfile.ZipFile(SRC_ZIP, "r") as zin, \
     zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_STORED) as zout:
    for r in picked:
        for src_path in (r["image_path"], r["label_path"]):
            try:
                with zin.open(src_path) as f:
                    data = f.read()
            except KeyError:
                print(f"  MISSING: {src_path}")
                continue
            zout.writestr(sanitize_path(src_path), data)
            n_written += 1
            if n_written % 500 == 0:
                print(f"  wrote {n_written} files...")

size_gb = OUT_ZIP.stat().st_size / 1e9
print(f"Done. {OUT_ZIP} ({size_gb:.2f} GB, {n_written} files)")

print(f"Writing {OUT_CSV.name} ...")
with open(OUT_CSV, "w", newline="") as f:
    w = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
    w.writerow(["image_path", "label_path", "split", "wsi_id", "epi_frac", "marsh_bin"])
    for r in picked:
        w.writerow([
            sanitize_path(r["image_path"]),
            sanitize_path(r["label_path"]),
            r["split"], r["wsi_id"], "", "",
        ])
print("\nNext step:")
print("  Kaggle → New Dataset → upload BOTH:")
print(f"    {OUT_ZIP}")
print(f"    {OUT_CSV}")
print("  Slug: gluten-ibdcolepi-sample")
