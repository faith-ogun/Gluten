"use client";

/**
 * Client-side driver for the Gemma 4 31B six-layer twin engine.
 *
 * Takes a structured patient payload, POSTs to /api/gemma/twin, and
 * renders the model's per-layer narratives with PubMed citations. The
 * parent supplies the deterministic confidence block separately
 * (already shown above the narratives), so this component focuses on
 * the model-generated prose.
 *
 * Latency for gemma4:31b-cloud is 15–40 s. The button is explicit (not
 * auto-run on mount) so the clinician controls when the call fires.
 */

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import type { TwinInputPayload, TwinResponse } from "@/lib/twin";
import { LAYERS, LAYER_ORDER, type LayerId } from "@/lib/layers";

function pubmedHref(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

const STRENGTH_TONE: Record<string, string> = {
  strong: "text-emerald-600",
  moderate: "text-wheat-deep",
  limited: "text-amber-700",
  insufficient: "text-alert",
};

export function TwinRun({
  payload,
  result,
  onResult,
}: {
  payload: TwinInputPayload;
  result: TwinResponse | null;
  onResult: (r: TwinResponse | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    onResult(null);
    try {
      const res = await fetch("/api/gemma/twin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(
          typeof data?.error === "string"
            ? data.error
            : `HTTP ${res.status}`,
        );
        return;
      }
      onResult(data as TwinResponse);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-wheat/50 bg-cream/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-wheat-deep" />
          <div className="font-mono text-[11px] uppercase tracking-widest text-wheat-deep">
            Twin reasoning · Gemma 4 31B
          </div>
        </div>
        {result && !busy && !err && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-warm">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            {result.model} · {(result.durationMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      <p className="mt-1 text-[12.5px] leading-relaxed text-warm">
        Cross-references the patient profile against six disease layers,
        grounded in retrieved PubMed abstracts. Confidence numbers above are
        deterministic; narratives below are generated with explicit citations.
      </p>

      {!result && (
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-deep bg-deep px-4 py-2 text-[12.5px] font-medium text-cream transition hover:bg-deep/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              reasoning across six layers…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Run twin engine
            </>
          )}
        </button>
      )}

      {err && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-[12.5px] text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Twin engine call failed.</div>
            <div className="mt-1 font-mono text-[11.5px]">{err}</div>
            {/401|unauthori[sz]ed/i.test(err) && (
              <div className="mt-2 text-[12px]">
                The <code>gemma4:31b-cloud</code> tag requires Ollama Cloud
                sign-in. In your terminal run <code className="rounded bg-rose-100 px-1">ollama signin</code>,
                or set <code>TWIN_MODEL</code> in <code>.env.local</code> to a
                locally pulled tag.
              </div>
            )}
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="mt-2 rounded border border-rose-400 bg-white px-2 py-1 text-[11.5px] text-rose-900 hover:bg-rose-50"
            >
              retry
            </button>
          </div>
        </div>
      )}

      {result && (() => {
        const gen = result.generation as Partial<TwinResponse["generation"]> | undefined;
        const overall = gen?.overall;
        const layers = gen?.layers;
        const equity = gen?.equity;

        // If the model returned a shape we can't render, show the raw
        // JSON so we can diagnose without losing the run.
        if (!overall || !layers) {
          return (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-[12.5px] text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Model returned an unexpected shape.</div>
                  <div className="mt-1 text-[11.5px]">
                    The call succeeded in {(result.durationMs / 1000).toFixed(1)}s
                    against {result.model}, but the response did not include an{" "}
                    <code>overall</code> / <code>layers</code> block. This usually
                    means the model ignored the structured-output schema. Try
                    again, or switch <code>TWIN_MODEL</code>.
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-mono text-[11px]">
                      raw generation JSON
                    </summary>
                    <pre className="mt-2 max-h-[400px] overflow-auto rounded bg-white p-2 font-mono text-[10.5px] leading-relaxed text-deep">
                      {JSON.stringify(gen, null, 2)}
                    </pre>
                  </details>
                  <button
                    type="button"
                    onClick={run}
                    className="mt-2 rounded border border-amber-400 bg-white px-2 py-1 text-[11.5px] text-amber-900 hover:bg-amber-100"
                  >
                    retry
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-line bg-wheat-pale/50 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-warm">
                Headline
              </div>
              <p className="mt-1 text-[14px] font-medium leading-snug text-deep">
                {overall.headline ?? "(no headline returned)"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11.5px] text-deep">
                {overall.marshTrajectory && (
                  <span>Marsh: <span className="text-wheat-deep">{overall.marshTrajectory}</span></span>
                )}
                {overall.ielTrajectory && (
                  <span>IEL: <span className="text-wheat-deep">{overall.ielTrajectory}</span></span>
                )}
                {overall.tTGTrajectory && (
                  <span>tTG: <span className="text-wheat-deep">{overall.tTGTrajectory}</span></span>
                )}
              </div>
              {overall.gfdResponse && (
                <p className="mt-2 text-[12.5px] leading-relaxed text-warm">
                  {overall.gfdResponse}
                </p>
              )}
              {overall.riskFlags && overall.riskFlags.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {overall.riskFlags.map((f, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-deep">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-wheat-deep" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {LAYER_ORDER.map((id: LayerId) => {
                const l = layers[id];
                if (!l) return null;
                const tone = STRENGTH_TONE[l.evidenceStrength] ?? "text-warm";
                return (
                  <div key={id} className="rounded-xl border border-line bg-cream p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium text-deep">
                        {LAYERS[id].label}
                      </span>
                      <span className={`font-mono text-[10px] uppercase tracking-widest ${tone}`}>
                        {l.evidenceStrength ?? "—"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-warm">
                      {l.narrative ?? "(no narrative returned)"}
                    </p>
                    {l.citedPmids && l.citedPmids.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {l.citedPmids.filter(Boolean).map((p) => (
                          <a
                            key={p}
                            href={pubmedHref(p)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-line bg-wheat-pale/40 px-2 py-0.5 font-mono text-[10.5px] text-deep hover:border-wheat-deep"
                          >
                            PMID {p}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {equity?.notes && (
              <div className="rounded-xl border border-wheat-deep/40 bg-wheat-pale/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-wheat-deep">
                    Equity note · demographic match {(equity.demographicMatch ?? "").toLowerCase()}
                  </div>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-deep">
                  {equity.notes}
                </p>
                {equity.citedPmids && equity.citedPmids.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {equity.citedPmids.filter(Boolean).map((p) => (
                      <a
                        key={p}
                        href={pubmedHref(p)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-wheat-deep/40 bg-cream px-2 py-0.5 font-mono text-[10.5px] text-deep hover:border-wheat-deep"
                      >
                        PMID {p}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
