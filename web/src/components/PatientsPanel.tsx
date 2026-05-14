"use client";

/**
 * Patients panel — left-sidebar list of recent de-identified contributions.
 *
 * Pulled from /api/contribute?list=1, which reads from Firestore (or the
 * local JSONL fallback) and returns the latest contributions in
 * reverse-chronological order. Click a row to open a detail dialog with
 * the full bucketed profile.
 *
 * This makes /app feel like a clinical tool that retains state across
 * sessions, not a single-shot demo flow.
 */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users, X, RefreshCw } from "lucide-react";

type Contribution = {
  contributionId: string;
  ageBucket?: string;
  sex?: string;
  ancestry?: string;
  hla?: string;
  marsh?: string;
  tTG_bin?: string;
  ema?: string;
  iel_bin?: string;
  gfdMonths_bin?: string;
  flags?: string[];
  contributedAtYear?: number;
  createdAt?: string | null;
};

const ANCESTRY_LABEL: Record<string, string> = {
  european: "European",
  african: "African",
  south_asian: "South Asian",
  east_asian: "East Asian",
  hispanic_latino: "Hispanic/Latino",
  middle_eastern: "Middle Eastern",
  mixed_other: "Mixed/Other",
  unknown: "—",
};

export function PatientsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<Contribution[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [mode, setMode] = useState<"firestore" | "local" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contribution | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/contribute?list=1&limit=12", {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        contributions: Contribution[];
        total: number;
        mode: "firestore" | "local";
        error?: string;
      };
      if (!res.ok || data.error) {
        setErr(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setItems(data.contributions ?? []);
      setTotal(data.total ?? 0);
      setMode(data.mode);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  // Auto-load on mount and whenever the parent bumps refreshKey
  // (e.g. after a new contribution).
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-warm" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-warm">
            Patients
          </span>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          aria-label="Refresh patient list"
          className="text-warm transition hover:text-deep disabled:opacity-40"
        >
          <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        </button>
      </div>

      <div className="rounded-3xl border border-line bg-cream p-3">
        {err && (
          <div className="rounded border border-alert/30 bg-alert/5 px-3 py-2 text-[12px] text-alert">
            {err}
          </div>
        )}
        {!err && items.length === 0 && !busy && (
          <p className="px-2 py-3 text-[12px] leading-relaxed text-warm">
            No contributions yet. Run a session through to Step 05 to add one.
          </p>
        )}
        {items.length > 0 && (
          <ul className="space-y-1">
            {items.map((p) => (
              <li key={p.contributionId}>
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-wheat-pale focus:bg-wheat-pale focus:outline-none"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-serif text-[14px] leading-tight text-deep">
                      {ANCESTRY_LABEL[p.ancestry ?? "unknown"] ?? "—"} ·{" "}
                      {p.ageBucket ?? "—"} · {sexShort(p.sex)}
                    </span>
                    <span className="font-mono text-[10px] text-warm">
                      {marshChip(p.marsh)}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-warm">
                    {formatDate(p.createdAt)} · {hlaShort(p.hla)} · tTG{" "}
                    {p.tTG_bin ?? "—"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {(total > 0 || mode) && (
          <div className="mt-3 flex items-center justify-between border-t border-line pt-2 px-2 font-mono text-[10px] text-warm">
            <span>{total.toLocaleString()} total</span>
            {mode && (
              <span className="rounded-full bg-cream px-2 py-0.5 text-[9px] uppercase tracking-widest">
                {mode}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <AnimatePresence>
        {selected && (
          <PatientDetail patient={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PatientDetail({
  patient,
  onClose,
}: {
  patient: Contribution;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-deep/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-paper p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-warm">
              De-identified profile
            </div>
            <h2 className="serif mt-1 text-2xl text-deep">
              {ANCESTRY_LABEL[patient.ancestry ?? "unknown"]} ·{" "}
              {patient.ageBucket ?? "—"} · {sexLong(patient.sex)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail"
            className="rounded-full p-2 text-warm transition hover:bg-cream hover:text-deep"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <DetailRow label="HLA" value={hlaShort(patient.hla)} />
          <DetailRow label="Marsh" value={marshChip(patient.marsh)} />
          <DetailRow label="tTG-IgA bin" value={patient.tTG_bin ?? "—"} />
          <DetailRow label="EMA" value={patient.ema ?? "—"} />
          <DetailRow label="IEL bin" value={patient.iel_bin ?? "—"} />
          <DetailRow label="GFD bin" value={patient.gfdMonths_bin ?? "—"} />
          <DetailRow
            label="Contributed"
            value={formatDate(patient.createdAt) ?? `${patient.contributedAtYear ?? "—"}`}
          />
          <DetailRow
            label="Contribution ID"
            value={
              <span className="font-mono text-[12px]">{patient.contributionId.slice(0, 12)}…</span>
            }
          />
        </dl>

        {patient.flags && patient.flags.length > 0 && (
          <div className="mt-5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-warm">
              Flags
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {patient.flags.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-line bg-cream px-3 py-1 text-[12px] text-deep"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-5 text-[11px] leading-relaxed text-warm">
          All identifiers were stripped server-side before write. Ages, tTG,
          IEL and GFD-duration are stored as ranges. No names, dates, or free
          text reach this dataset.
        </p>
      </motion.div>
    </motion.div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-warm">{label}</dt>
      <dd className="mt-0.5 text-deep">{value}</dd>
    </div>
  );
}

function sexShort(s?: string) {
  if (s === "female") return "F";
  if (s === "male") return "M";
  return s ?? "—";
}
function sexLong(s?: string) {
  if (s === "female") return "Female";
  if (s === "male") return "Male";
  if (s === "other") return "Other";
  return "—";
}
function hlaShort(h?: string) {
  if (!h || h === "unknown" || h === "negative") return h ?? "—";
  return `HLA-${h.toUpperCase()}`;
}
function marshChip(m?: string) {
  return m ? `Marsh-${m}` : "—";
}
function formatDate(s?: string | null) {
  if (!s) return null;
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}
