"""
Build the demo-mode manifest for the Marsh tile.

Inputs:
  results/marsh_pseudo_labels_scored.csv   — 2552 rows; filtering to Testset (400)
Outputs:
  web/public/marsh-demo/manifest.json

Schema:
{
  "generated": "2026-05-12T...",
  "split": "Testset (held-out, IBDColEpi v1 evaluation set)",
  "patches": {
    "<basename without ext>": {
      "filename": "...",
      "proxy_marsh": "Marsh-3b",
      "epi_frac": 0.123,
      "wsi_id": "23"
    }
  },
  "bin_edges": [...quantile boundaries the v1 notebook used...],
  "class_counts": {"Marsh-0": 81, ...},
  "caveat": "Proxy labels..."
}

Used by web/src/app/api/medgemma/marsh/route.ts as a fallback when the
sidecar URL is unreachable. Predictions remain proxy labels (deterministic
from epithelium fraction) until either v2 retrain finishes or v1 inference
is run offline against the test split.
"""

from __future__ import annotations

import csv
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "results" / "marsh_pseudo_labels_scored.csv"
DST = ROOT / "web" / "public" / "marsh-demo" / "manifest.json"


def basename_key(image_path: str) -> str:
    stem = Path(image_path).stem
    return stem


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC}", file=sys.stderr)
        return 1

    patches: dict[str, dict] = {}
    counts: Counter[str] = Counter()
    epi_by_class: dict[str, list[float]] = {}

    with SRC.open() as f:
        for row in csv.DictReader(f):
            if row["split"] != "Testset":
                continue
            key = basename_key(row["image_path"])
            epi = float(row["epi_frac"])
            marsh = row["marsh_bin"]
            patches[key] = {
                "filename": row["image_path"],
                "proxy_marsh": marsh,
                "epi_frac": round(epi, 5),
                "wsi_id": row["wsi_id"],
            }
            counts[marsh] += 1
            epi_by_class.setdefault(marsh, []).append(epi)

    bin_edges = []
    for marsh in ["Marsh-3b", "Marsh-3a", "Marsh-1", "Marsh-0"]:
        vals = sorted(epi_by_class.get(marsh, []))
        if vals:
            bin_edges.append(
                {
                    "class": marsh,
                    "min_epi": round(vals[0], 5),
                    "max_epi": round(vals[-1], 5),
                    "median_epi": round(vals[len(vals) // 2], 5),
                    "n": len(vals),
                }
            )

    manifest = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "split": "Testset (held-out, IBDColEpi v1 evaluation set)",
        "source_csv": "results/marsh_pseudo_labels_scored.csv",
        "n_patches": len(patches),
        "class_counts": dict(counts),
        "bin_edges": bin_edges,
        "caveat": (
            "Demo-mode predictions are proxy Marsh labels derived deterministically "
            "from epithelium-mask coverage (IBDColEpi). They are NOT Gemma 4 model "
            "predictions, and they are NOT pathologist-validated Marsh grades. "
            "Live model inference activates when MARSH_SIDECAR_URL is reachable."
        ),
        "patches": patches,
    }

    DST.parent.mkdir(parents=True, exist_ok=True)
    DST.write_text(json.dumps(manifest, indent=2))
    size_kb = os.path.getsize(DST) / 1024
    print(f"wrote {DST.relative_to(ROOT)} ({size_kb:.1f} KB, {len(patches)} patches)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
