"use client";

/**
 * Structural-layer tile classifier.
 *
 * Drag-and-drop or click to upload an HE-stained patch. The image is
 * base64-encoded client-side and POSTed to /api/medgemma/marsh, which
 * proxies to the FastAPI sidecar (Gemma 4 E4B + LoRA, 72% accuracy /
 * Marsh-3b F1 0.87). The caveat from the sidecar is shown verbatim so
 * the clinician sees the weak-supervision provenance.
 */

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, AlertTriangle, FileImage } from "lucide-react";

// Browsers can't render TIF via <img>. utif decodes the bytes in-browser
// (~50 KB lib, no Emscripten) so we can draw a real preview to canvas.
// The model still receives the original TIF bytes for inference.
async function tifToPngDataUrl(file: File): Promise<string | null> {
  try {
    const UTIF = (await import("utif")).default ?? (await import("utif"));
    const buf = await file.arrayBuffer();
    const ifds = UTIF.decode(buf);
    if (!ifds || ifds.length === 0) return null;
    UTIF.decodeImage(buf, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const w = ifds[0].width;
    const h = ifds[0].height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const imageData = ctx.createImageData(w, h);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("[MarshTile] TIF decode failed:", e);
    return null;
  }
}

type Result = {
  mode?: "live" | "demo";
  marsh?: string;
  raw?: string;
  classes?: string[];
  device?: string;
  latency_ms?: number;
  epi_frac?: number;
  wsi_id?: string;
  caveat?: string;
  error?: string;
  message?: string;
};

const MAX_BYTES = 8 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function MarshTile() {
  const [preview, setPreview] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewable, setPreviewable] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(async (file: File) => {
    setErr(null);
    setResult(null);
    if (file.size > MAX_BYTES) {
      setErr("Image too large (max 8 MB).");
      return;
    }
    // Allow standard image MIME types OR explicit pathology extensions
    // (drag-drop on macOS often reports empty MIME for .tif).
    const isImageMime = file.type.startsWith("image/");
    const isPathologyExt = /\.(tiff?|svs|ndpi|vsi|scn)$/i.test(file.name);
    if (!isImageMime && !isPathologyExt) {
      setErr("File must be an image.");
      return;
    }
    // Browsers can't render TIF via <img>. For TIF files, decode with utif
    // and convert to a PNG data URL so the preview shows the actual tissue.
    // The model still receives the original TIF bytes for inference.
    setPreviewName(file.name);
    const isTif = /\.(tiff?)$/i.test(file.name);
    const isOtherWSI = /\.(svs|ndpi|vsi|scn)$/i.test(file.name);
    if (isTif) {
      setPreview(null);
      setPreviewable(false); // show "decoding..." state via setBusy below
      const png = await tifToPngDataUrl(file);
      if (png) {
        setPreview(png);
        setPreviewable(true);
      } else {
        setPreviewable(false);
      }
    } else if (isOtherWSI) {
      // SVS / NDPI / VSI / SCN are gigapixel formats — would need
      // OpenSeadragon + a pre-tiled pyramid. Out of scope. Placeholder only.
      setPreview(null);
      setPreviewable(false);
    } else {
      setPreview(URL.createObjectURL(file));
      setPreviewable(true);
    }
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await fetch("/api/medgemma/marsh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: b64, filename: file.name }),
      });
      const data = (await res.json()) as Result;
      setResult(data);
      if (!res.ok) setErr(data.message ?? data.error ?? `HTTP ${res.status}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="rounded-lg border border-black/10 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-xl">Structural layer · Marsh classifier</h3>
        <span className="text-xs text-black/50">Gemma 4 E4B merged · 70% train · 64% deploy · F1 0.83 (3b)</span>
      </div>

      <p className="mt-1 text-sm text-black/60">
        Upload an HE-stained duodenal mucosa patch. Returns Marsh-0 / 1 / 3a / 3b.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Setting dropEffect makes the cursor show the "copy" indicator
            // and tells the browser this is a valid drop target.
            e.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handle(f);
          }}
          className={
            "flex h-40 w-full items-center justify-center rounded border border-dashed text-sm transition " +
            (dragOver
              ? "border-wheat-deep bg-wheat-light/60 text-wheat-deep ring-2 ring-wheat-deep/30"
              : "border-black/20 bg-black/[0.02] text-black/60 hover:border-wheat-deep hover:text-wheat-deep")
          }
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="patch" className="h-full w-full rounded object-cover" />
          ) : previewName && !previewable ? (
            <span className="flex flex-col items-center gap-1 px-3 text-center">
              <FileImage className="h-6 w-6 text-wheat-deep" />
              <span className="font-mono text-[11px] text-deep">{previewName}</span>
              <span className="text-[10px] text-warm">
                .tif preview not rendered — model receives bytes
              </span>
            </span>
          ) : dragOver ? (
            <span className="flex flex-col items-center gap-2 font-medium">
              <ImagePlus className="h-5 w-5" />
              Drop patch here
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2">
              <ImagePlus className="h-5 w-5" />
              Drag &amp; drop or click
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
          }}
        />

        <div className="min-h-[10rem] rounded bg-black/[0.02] p-4 text-sm">
          {busy && (
            <div className="flex items-center gap-2 text-black/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Running on sidecar (first call cold-loads the model, ~30 s)
            </div>
          )}
          {!busy && err && (
            <div className="flex items-start gap-2 text-alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}
          {!busy && !err && result?.marsh && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-black/50">
                    {result.mode === "demo" ? "Proxy label (demo mode)" : "Predicted"}
                  </div>
                  <div className="font-serif text-2xl text-wheat-deep">{result.marsh}</div>
                </div>
                {result.mode === "demo" && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-900">
                    demo
                  </span>
                )}
              </div>
              <div className="text-xs text-black/60">
                {result.device} · {result.latency_ms} ms
                {result.mode === "live" && result.raw && (
                  <>
                    {" · raw: "}
                    <span className="font-mono">{result.raw}</span>
                  </>
                )}
                {result.mode === "demo" && typeof result.epi_frac === "number" && (
                  <> · epi_frac: {result.epi_frac.toFixed(3)} · WSI {result.wsi_id}</>
                )}
              </div>
              {result.caveat && (
                <p className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-900">
                  {result.caveat}
                </p>
              )}
            </div>
          )}
          {!busy && !err && !result && (
            <div className="text-black/50">No patch yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
