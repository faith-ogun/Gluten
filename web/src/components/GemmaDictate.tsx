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

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mic,
  MicOff,
} from "lucide-react";

// Browser Web Speech API. webkit-prefixed in Chrome/Safari, unprefixed
// in Edge. No new deps; falls back gracefully when unsupported.
// NOTE: `event.results` is a `SpeechRecognitionResultList`, which is
// array-like (numeric indices + .length) but NOT a real Array. Calling
// .filter / .map on it throws "a.filter is not a function". Always
// iterate with a plain for-loop.
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechResultList = ArrayLike<SpeechResult>;
type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SRConstructor = new () => SpeechRecognition;

function getSpeechRecognition(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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

  const [recording, setRecording] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  // `mounted` gates anything that depends on browser APIs so SSR and
  // client first render produce identical HTML (avoids React #418
  // hydration errors). Anything mic-related lives behind this flag.
  const [mounted, setMounted] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Append-and-rebuild pattern: each final result chunk is appended to
  // committedRef; interim chunks are shown live but not committed yet.
  const committedRef = useRef("");

  useEffect(() => {
    setMounted(true);
    setMicSupported(Boolean(getSpeechRecognition()));
  }, []);

  const startRecording = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-GB";

    // Snapshot whatever's already in the textarea so we append to it
    // rather than overwrite when the user starts a new dictation.
    const prefix = text.trim().length > 0 ? text.trim() + " " : "";
    committedRef.current = prefix;

    recognition.onresult = (event) => {
      try {
        // SpeechRecognitionResultList is array-like; iterate manually.
        const results = event.results;
        let finalChunks = "";
        let interim = "";
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const t = r[0]?.transcript ?? "";
          if (r.isFinal) {
            finalChunks += (finalChunks ? " " : "") + t.trim();
          } else {
            interim += (interim ? " " : "") + t.trim();
          }
        }
        const combined = [
          committedRef.current,
          finalChunks,
          interim,
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        setText(combined);
      } catch (e) {
        // Never let a recognition event strand the recording state.
        console.warn("[dictation] onresult handler failed:", e);
        setErr(e instanceof Error ? e.message : String(e));
      }
    };

    recognition.onerror = (e) => {
      setErr(`microphone: ${e.error}`);
      setRecording(false);
    };
    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setErr(null);
    setRecording(true);
    try {
      recognition.start();
    } catch (e) {
      // Some browsers throw if start() is called twice; reset state.
      setRecording(false);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [text]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  // Stop recording if component unmounts mid-recording
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

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

      <div className="relative mt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={4}
          disabled={busy}
          className="w-full resize-none rounded-xl border border-line bg-cream p-3 pr-12 font-mono text-[12.5px] text-deep placeholder:text-warm/60 focus:border-wheat-deep focus:outline-none disabled:opacity-60"
        />
        {mounted && micSupported && (
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={busy}
            aria-label={recording ? "Stop dictation" : "Start dictation"}
            title={recording ? "Stop dictation" : "Dictate"}
            className={
              "absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 " +
              (recording
                ? "border-rose-400 bg-rose-100 text-rose-700 shadow-sm"
                : "border-line bg-cream text-warm hover:border-wheat-deep hover:text-wheat-deep")
            }
          >
            {recording ? (
              <>
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-rose-500/80" />
                <MicOff className="h-4 w-4" />
              </>
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

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
        <div className="flex items-center gap-3">
          {mounted && recording && (
            <span className="font-mono text-[11px] text-rose-700">
              listening…
            </span>
          )}
          {mounted && !micSupported && (
            <span
              className="font-mono text-[10px] text-warm/70"
              title="Web Speech API not detected. Use Chrome, Edge, or Safari."
            >
              dictation unsupported in this browser
            </span>
          )}
          {text.length > 0 && !busy && !recording && (
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
