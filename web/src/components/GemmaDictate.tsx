"use client";

/**
 * Dictation panel: clinician pastes / types free-text, Gemma 4 E4B (local,
 * via Ollama) extracts a structured FHIR-compatible profile and fills the
 * wizard form. The reasoning trail is displayed so the clinician can
 * verify the mapping before moving on.
 *
 * This is the CLAUDE.md §3.1 Step 1 input hero — the Ollama-prize-track
 * surface of Glüten. Model + extractor live at /api/gemma/extract.
 */

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

type Mode = "screen" | "twin";

interface ExtractResponse {
  mode: Mode;
  fields: Record<string, unknown>;
  reasoning: string;
  durationMs: number;
}

interface ExtractError {
  error: string;
}

export function GemmaDictate<T>({
  mode,
  placeholder,
  onApply,
}: {
  mode: Mode;
  placeholder: string;
  onApply: (patch: Partial<T>) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 3 || busy) return;
    setBusy(true);
    setErr(null);
    setReasoning(null);
    try {
      const res = await fetch("/api/gemma/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, text: trimmed }),
      });
      const data = (await res.json()) as ExtractResponse | ExtractError;
      if (!res.ok || "error" in data) {
        setErr("error" in data ? data.error : `HTTP ${res.status}`);
        return;
      }
      onApply(data.fields as Partial<T>);
      setReasoning(data.reasoning);
      setDurationMs(data.durationMs);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-wheat/40 bg-gradient-to-br from-wheat-pale/60 to-cream p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-wheat-deep" />
          <div className="font-mono text-[11px] uppercase tracking-widest text-wheat-deep">
            Dictate with Gemma 4 E4B · on-device
          </div>
        </div>
        {durationMs !== null && !busy && !err && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-warm">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            extracted in {(durationMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      <p className="mt-1 text-[12px] leading-relaxed text-warm">
        Paste clinical notes or a voice transcript — Gemma 4 E4B runs locally
        via Ollama and fills the form below. Values are enforced against the
        FHIR-compatible schema.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={4}
        disabled={busy}
        className="mt-3 w-full resize-none rounded-xl border border-line bg-cream p-3 font-mono text-[12.5px] text-deep placeholder:text-warm/60 focus:border-wheat-deep focus:outline-none disabled:opacity-60"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy || text.trim().length < 3}
          className="inline-flex items-center gap-2 rounded-xl border border-deep bg-deep px-4 py-2 text-[12.5px] font-medium text-cream transition hover:bg-deep/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              extracting…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Extract with Gemma 4 E4B
            </>
          )}
        </button>
        {text.length > 0 && !busy && (
          <button
            type="button"
            onClick={() => {
              setText("");
              setReasoning(null);
              setErr(null);
              setDurationMs(null);
            }}
            className="font-mono text-[11px] text-warm hover:text-deep"
          >
            clear
          </button>
        )}
      </div>

      {err && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-[12px] text-rose-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Extraction failed.</strong> {err}
          </span>
        </div>
      )}

      {reasoning && !err && (
        <div className="mt-3 rounded-xl border border-line bg-cream/80 p-3 text-[12px] leading-relaxed text-deep">
          <div className="font-mono text-[10px] uppercase tracking-widest text-warm">
            Gemma's mapping
          </div>
          <p className="mt-1.5">{reasoning}</p>
        </div>
      )}
    </div>
  );
}
