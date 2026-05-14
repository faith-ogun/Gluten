/**
 * Structural-layer Marsh classifier endpoint.
 *
 * Primary path: forwards to `services/marsh-sidecar` (FastAPI + Gemma 4 E4B
 * + LoRA, 72% / Marsh-3b F1 0.87) at MARSH_SIDECAR_URL.
 *
 * Demo-mode fallback: if MARSH_SIDECAR_URL is unset OR the sidecar errors,
 * we look up the uploaded patch in the held-out test-set manifest by
 * filename basename and return its **proxy Marsh label** (deterministic
 * from epithelium-mask coverage, NOT a Gemma 4 prediction). This keeps
 * the live demo URL functional while preserving honest provenance.
 *
 * Provenance: per CLAUDE.md §19, "Pre-computed results are acceptable for
 * demo purposes if the pipeline code is verifiable in the repository."
 */

import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const SIDECAR_URL = process.env.MARSH_SIDECAR_URL;
const TIMEOUT_MS = 60_000;

type Patch = {
  filename: string;
  proxy_marsh: string;
  epi_frac: number;
  wsi_id: string;
};
type Manifest = {
  generated: string;
  n_patches: number;
  caveat: string;
  patches: Record<string, Patch>;
};

let cachedManifest: Manifest | null = null;
async function getManifest(): Promise<Manifest | null> {
  if (cachedManifest) return cachedManifest;
  try {
    const p = path.join(process.cwd(), "public", "marsh-demo", "manifest.json");
    const raw = await fs.readFile(p, "utf-8");
    cachedManifest = JSON.parse(raw) as Manifest;
    return cachedManifest;
  } catch {
    return null;
  }
}

function basenameKey(filename: string): string {
  const last = filename.split(/[\\/]/).pop() ?? filename;
  return last.replace(/\.[^.]+$/, "");
}

async function demoLookup(filename: string | undefined) {
  const manifest = await getManifest();
  if (!manifest) {
    return {
      error: "demo_manifest_missing",
      message:
        "Marsh sidecar unreachable and demo-mode manifest not built. Run scripts/build_marsh_demo_manifest.py.",
    };
  }
  if (!filename) {
    return {
      mode: "demo",
      error: "demo_no_filename",
      message:
        "Live model is offline. Demo-mode requires the original test-set filename; the uploader did not send one.",
      classes: ["Marsh-0", "Marsh-1", "Marsh-3a", "Marsh-3b"],
      caveat: manifest.caveat,
    };
  }
  const key = basenameKey(filename);
  const hit = manifest.patches[key];
  if (!hit) {
    return {
      mode: "demo",
      error: "demo_unknown_patch",
      message: `Live model is offline. Patch "${filename}" is not in the held-out test set, so demo-mode has no proxy label for it.`,
      classes: ["Marsh-0", "Marsh-1", "Marsh-3a", "Marsh-3b"],
      caveat: manifest.caveat,
    };
  }
  return {
    mode: "demo",
    marsh: hit.proxy_marsh,
    raw: hit.proxy_marsh,
    classes: ["Marsh-0", "Marsh-1", "Marsh-3a", "Marsh-3b"],
    device: "demo-lookup",
    latency_ms: 1,
    epi_frac: hit.epi_frac,
    wsi_id: hit.wsi_id,
    caveat: manifest.caveat,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { imageBase64?: string; filename?: string }
    | null;
  if (!body?.imageBase64) {
    return Response.json({ error: "missing_image" }, { status: 400 });
  }

  if (!SIDECAR_URL) {
    const out = await demoLookup(body.filename);
    return Response.json(out, { status: "marsh" in out ? 200 : 503 });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(SIDECAR_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_b64: body.imageBase64 }),
      signal: ac.signal,
    });
    if (!res.ok) {
      const out = await demoLookup(body.filename);
      return Response.json(
        { ...out, sidecar_status: res.status },
        { status: "marsh" in out ? 200 : 502 },
      );
    }
    const data = await res.json();
    return Response.json({ ...data, mode: "live" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const out = await demoLookup(body.filename);
    return Response.json(
      { ...out, sidecar_error: msg },
      { status: "marsh" in out ? 200 : 504 },
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const manifest = await getManifest();
  const demo = manifest
    ? { ready: true, n_patches: manifest.n_patches, generated: manifest.generated }
    : { ready: false };

  if (!SIDECAR_URL) {
    return Response.json({ ok: true, wired: false, mode: "demo", demo });
  }
  try {
    const healthUrl = SIDECAR_URL.replace(/\/predict$/, "/health");
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
    return Response.json({
      ok: res.ok,
      wired: true,
      mode: res.ok ? "live" : "demo",
      sidecar: await res.json().catch(() => null),
      demo,
    });
  } catch (e) {
    return Response.json({
      ok: false,
      wired: true,
      mode: "demo",
      error: String(e),
      demo,
    });
  }
}
