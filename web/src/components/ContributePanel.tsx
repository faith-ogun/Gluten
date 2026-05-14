"use client";

/**
 * Clinician contribution panel.
 *
 * Flow:
 *   1. Clinician fills the draft form (or it's pre-populated from the
 *      patient profile they were just looking at).
 *   2. Clicks "Contribute to research pool". A confirm step shows
 *      the per-field scrub diff that will happen, with strikethrough
 *      animations on the values being bucketed / dropped.
 *   3. On confirm, the request hits /api/contribute. While in flight,
 *      the (already-scrubbed) profile card folds into a paper airplane
 *      and flies into a small "twin" target icon at the top of the panel.
 *   4. On success, a toast appears ("Thanks for contributing"), and a
 *      muted chip persists ("This was contribution #142 to the global
 *      coeliac dataset").
 *
 * Tone: not gamified. No XP, levels, streaks. The counter is research-
 * credit framing, not a leaderboard. The whole UI uses brand tokens.
 */

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ShieldCheck, X } from "lucide-react";

type Draft = {
  age?: number;
  sex?: "female" | "male" | "other";
  ancestry?:
    | "european"
    | "african"
    | "south_asian"
    | "east_asian"
    | "hispanic_latino"
    | "middle_eastern"
    | "mixed_other"
    | "unknown";
  hla?: "dq2.5" | "dq2.2" | "dq8" | "negative" | "unknown";
  marsh?: "0" | "1" | "2" | "3a" | "3b" | "3c";
  tTG?: number;
  ema?: "positive" | "negative" | "unknown";
  iel?: number;
  gfdMonths?: number;
  flags?: string[];
  notes?: string;
};

type DiffRow = {
  field: string;
  before: string;
  after: string;
  reason: string;
};

type Result = {
  contributionId: string;
  total: number;
  mode: "firestore" | "local";
  diff: DiffRow[];
};

type Phase = "form" | "preview" | "flying" | "done";

const REASON_LABEL: Record<string, string> = {
  exact_value_bucketed: "Coerced to range",
  free_text_dropped: "Free text dropped",
  unknown_flag_dropped: "Flag not in vocabulary",
  identifier_redacted: "Identifier redacted",
  field_not_collected: "Field not collected",
};

const FLAG_OPTIONS = [
  { value: "iron_deficiency", label: "Iron deficiency" },
  { value: "b12_deficiency", label: "B12 deficiency" },
  { value: "osteoporosis", label: "Osteoporosis" },
  { value: "t1d", label: "Type 1 diabetes" },
  { value: "thyroid", label: "Autoimmune thyroid" },
  { value: "dh", label: "Dermatitis herpetiformis" },
  { value: "family_history_ad", label: "Family history (autoimmune)" },
];

const DEFAULT_DRAFT: Draft = {
  age: 28,
  sex: "female",
  ancestry: "african",
  hla: "dq2.5",
  marsh: "3b",
  tTG: 84,
  ema: "positive",
  iel: 42,
  gfdMonths: 6,
  flags: ["iron_deficiency", "family_history_ad"],
  notes: "",
};

export function ContributePanel({
  initial = DEFAULT_DRAFT,
  onSuccess,
}: {
  initial?: Draft;
  onSuccess?: (result: { contributionId: string; total: number }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [draft, setDraft] = useState<Draft>(initial);
  const [diff, setDiff] = useState<DiffRow[] | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = useCallback(<K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
  }, []);

  const toggleFlag = useCallback((flag: string) => {
    setDraft((d) => {
      const flags = new Set(d.flags ?? []);
      if (flags.has(flag)) flags.delete(flag);
      else flags.add(flag);
      return { ...d, flags: [...flags] };
    });
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as Result & { error?: string };
      if (!res.ok) {
        setErr(data.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setResult(data);
      setDiff(data.diff);
      setPhase("flying");
      window.setTimeout(() => {
        setPhase("done");
        onSuccess?.({ contributionId: data.contributionId, total: data.total });
      }, 1700);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [draft]);

  const previewDiff = useMemo(() => buildPreviewDiff(draft), [draft]);

  return (
    <section className="relative rounded-lg border border-line bg-white p-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h3 className="serif text-xl text-deep">Contribute to the global pool</h3>
          <p className="mt-1 text-sm text-warm">
            With patient consent, send a de-identified version of this profile to the
            research dataset. Glüten never touches names, dates, identifiers, or free
            text. You see exactly what leaves your device.
          </p>
        </div>
        <div className="ml-4 flex shrink-0 items-center gap-2 rounded-full border border-line bg-cream px-3 py-1.5 text-[11px] uppercase tracking-widest text-warm">
          <ShieldCheck className="h-3.5 w-3.5 text-safe" />
          De-identified server-side
        </div>
      </header>

      {/* FORM PHASE */}
      {phase === "form" && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            label="Age (exact)"
            note="will become a 10-year range"
            input={
              <input
                type="number"
                value={draft.age ?? ""}
                onChange={(e) =>
                  set("age", e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full rounded border border-line bg-cream px-3 py-2 text-sm"
              />
            }
          />
          <Field
            label="Sex"
            input={
              <Select
                value={draft.sex ?? ""}
                onChange={(v) => set("sex", v as Draft["sex"])}
                options={["female", "male", "other"]}
              />
            }
          />
          <Field
            label="Ancestry"
            input={
              <Select
                value={draft.ancestry ?? ""}
                onChange={(v) => set("ancestry", v as Draft["ancestry"])}
                options={[
                  "european",
                  "african",
                  "south_asian",
                  "east_asian",
                  "hispanic_latino",
                  "middle_eastern",
                  "mixed_other",
                  "unknown",
                ]}
              />
            }
          />
          <Field
            label="HLA"
            input={
              <Select
                value={draft.hla ?? ""}
                onChange={(v) => set("hla", v as Draft["hla"])}
                options={["dq2.5", "dq2.2", "dq8", "negative", "unknown"]}
              />
            }
          />
          <Field
            label="Marsh score"
            input={
              <Select
                value={draft.marsh ?? ""}
                onChange={(v) => set("marsh", v as Draft["marsh"])}
                options={["0", "1", "2", "3a", "3b", "3c"]}
              />
            }
          />
          <Field
            label="tTG-IgA (U/mL, exact)"
            note="will become a clinical range"
            input={
              <input
                type="number"
                value={draft.tTG ?? ""}
                onChange={(e) =>
                  set("tTG", e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full rounded border border-line bg-cream px-3 py-2 text-sm"
              />
            }
          />
          <Field
            label="EMA"
            input={
              <Select
                value={draft.ema ?? ""}
                onChange={(v) => set("ema", v as Draft["ema"])}
                options={["positive", "negative", "unknown"]}
              />
            }
          />
          <Field
            label="Months on GFD"
            note="will become a phase bucket"
            input={
              <input
                type="number"
                value={draft.gfdMonths ?? ""}
                onChange={(e) =>
                  set("gfdMonths", e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full rounded border border-line bg-cream px-3 py-2 text-sm"
              />
            }
          />
          <div className="sm:col-span-2">
            <div className="text-[11px] uppercase tracking-widest text-warm">
              Co-morbidities and red flags (controlled vocabulary)
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {FLAG_OPTIONS.map((f) => {
                const on = (draft.flags ?? []).includes(f.value);
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => toggleFlag(f.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      on
                        ? "border-wheat-deep bg-wheat-light text-deep"
                        : "border-line bg-cream text-warm hover:border-wheat"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Clinician notes"
              note="ALWAYS dropped — never reaches the dataset"
              input={
                <textarea
                  rows={2}
                  value={draft.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="(anything here will be discarded server-side)"
                  className="w-full rounded border border-line bg-cream px-3 py-2 text-sm"
                />
              }
            />
          </div>

          <div className="sm:col-span-2 mt-2 flex items-center justify-between">
            <p className="text-xs text-warm">
              Patient consent is handled under your institutional governance. Glüten
              writes only the structured fields you see; nothing else.
            </p>
            <button
              type="button"
              onClick={() => setPhase("preview")}
              className="rounded-full bg-deep px-5 py-2.5 text-sm text-cream hover:bg-charcoal"
            >
              Preview what gets sent
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW PHASE */}
      {phase === "preview" && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h4 className="serif text-lg text-deep">Scrub preview</h4>
            <button
              type="button"
              onClick={() => setPhase("form")}
              className="flex items-center gap-1 text-xs text-warm hover:text-deep"
            >
              <X className="h-3 w-3" /> back
            </button>
          </div>
          <p className="mt-1 text-sm text-warm">
            These fields will be transformed or dropped on the server before anything is
            written. You are watching the actual rules from{" "}
            <code className="font-mono text-[12px]">lib/deidentify.ts</code>.
          </p>
          <ul className="mt-4 divide-y divide-line rounded border border-line bg-cream">
            {previewDiff.map((d, i) => (
              <DiffRowAnim key={i} index={i} row={d} />
            ))}
            {previewDiff.length === 0 && (
              <li className="px-4 py-3 text-sm text-warm">
                Nothing to scrub on this draft. Output is already de-identified.
              </li>
            )}
          </ul>

          {err && (
            <div className="mt-3 rounded border border-alert/30 bg-alert/5 px-3 py-2 text-sm text-alert">
              {err}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setPhase("form")}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm text-deep"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="flex items-center gap-2 rounded-full bg-wheat-deep px-5 py-2.5 text-sm text-cream hover:bg-charcoal disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {busy ? "Sending..." : "Contribute"}
            </button>
          </div>
        </div>
      )}

      {/* FLYING PHASE — paper airplane animation */}
      <AnimatePresence>
        {phase === "flying" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden rounded-lg"
          >
            <motion.div
              initial={{ x: -340, y: 80, opacity: 0, rotate: -10, scale: 0.9 }}
              animate={{
                x: 0,
                y: -260,
                opacity: [0, 1, 1, 0],
                rotate: [-10, 0, 8, 18],
                scale: [0.9, 1, 0.85, 0.5],
              }}
              transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
              className="absolute right-10 top-10"
            >
              <PaperPlane />
            </motion.div>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.6, 1.1, 1], opacity: [0, 1, 1] }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="absolute right-6 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-deep text-wheat shadow-lg"
              aria-label="Disease twin"
            >
              <span className="serif text-xl leading-none">Glü</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DONE PHASE — toast + counter chip */}
      {phase === "done" && result && (
        <DoneState
          result={result}
          onReset={() => {
            setPhase("form");
            setDiff(null);
            setResult(null);
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Field({
  label,
  note,
  input,
}: {
  label: string;
  note?: string;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-widest text-warm">{label}</span>
        {note && <span className="text-[11px] italic text-warm/70">{note}</span>}
      </div>
      <div className="mt-1.5">{input}</div>
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-line bg-cream px-3 py-2 text-sm"
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function DiffRowAnim({ row, index }: { row: DiffRow; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="grid grid-cols-[1fr_auto_1fr_140px] items-center gap-3 px-4 py-3 text-sm"
    >
      <div>
        <div className="text-[11px] uppercase tracking-widest text-warm">
          {row.field}
        </div>
        <div className="mt-0.5 text-deep">
          <motion.span
            initial={{ opacity: 1 }}
            animate={{ opacity: 0.55 }}
            transition={{ delay: 0.2 + index * 0.06 }}
            className="relative"
          >
            <span>{row.before}</span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.25 + index * 0.06, duration: 0.35 }}
              style={{ transformOrigin: "left" }}
              className="absolute left-0 right-0 top-1/2 block h-[1.5px] bg-alert"
            />
          </motion.span>
        </div>
      </div>
      <div className="text-warm">→</div>
      <div>
        <div className="text-[11px] uppercase tracking-widest text-warm">After</div>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + index * 0.06 }}
          className="mt-0.5 font-mono text-[13px] text-safe"
        >
          {row.after === "(dropped)" ? (
            <span className="rounded bg-alert/10 px-1.5 py-0.5 text-alert">
              dropped
            </span>
          ) : (
            row.after
          )}
        </motion.div>
      </div>
      <div className="text-right text-[11px] uppercase tracking-widest text-warm">
        {REASON_LABEL[row.reason] ?? row.reason}
      </div>
    </motion.li>
  );
}

function DoneState({
  result,
  onReset,
}: {
  result: Result;
  onReset: () => void;
}) {
  return (
    <div className="mt-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 rounded border border-safe/30 bg-safe/5 px-4 py-3"
      >
        <ShieldCheck className="mt-0.5 h-5 w-5 text-safe" />
        <div className="flex-1">
          <div className="serif text-base text-deep">Thanks for contributing.</div>
          <p className="mt-1 text-sm text-warm">
            The de-identified profile was added to the global coeliac dataset. You can
            see exactly what was written above.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs uppercase tracking-widest text-warm hover:text-deep"
        >
          New
        </button>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 flex items-center gap-3 text-sm text-warm"
      >
        <span className="font-mono text-[12px]">
          contribution #{result.total.toLocaleString()}
        </span>
        <span className="opacity-50">·</span>
        <span className="font-mono text-[12px]">{result.contributionId}</span>
        <span className="opacity-50">·</span>
        <span className="rounded-full border border-line bg-cream px-2 py-0.5 text-[11px] uppercase tracking-widest">
          {result.mode}
        </span>
      </motion.div>
    </div>
  );
}

function PaperPlane() {
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" fill="none">
      <path
        d="M86 6 L6 40 L36 50 L48 80 L86 6 Z"
        fill="var(--color-wheat)"
        stroke="var(--color-charcoal)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M86 6 L36 50 L48 80"
        stroke="var(--color-charcoal)"
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M36 50 L6 40"
        stroke="var(--color-charcoal)"
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
        opacity={0.65}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Local preview — what WOULD happen if we sent now. Keeps the user   */
/* honest about the scrub even before they click contribute.          */
/* ------------------------------------------------------------------ */

function buildPreviewDiff(draft: Draft): DiffRow[] {
  const out: DiffRow[] = [];
  const decadeBucket = (n?: number) => {
    if (n === undefined) return undefined;
    if (n >= 80) return "80+";
    const d = Math.floor(n / 10);
    return `${d * 10}-${d * 10 + 9}`;
  };
  const tTGBin = (n?: number) =>
    n === undefined
      ? undefined
      : n < 20
        ? "<20"
        : n < 50
          ? "20-50"
          : n < 100
            ? "50-100"
            : ">100";
  const ielBin = (n?: number) =>
    n === undefined ? undefined : n < 25 ? "<25" : n <= 40 ? "25-40" : ">40";
  const gfdBin = (n?: number) =>
    n === undefined
      ? undefined
      : n === 0
        ? "0"
        : n <= 3
          ? "1-3"
          : n <= 6
            ? "4-6"
            : n <= 12
              ? "7-12"
              : n <= 24
                ? "13-24"
                : ">24";

  if (draft.age !== undefined)
    out.push({
      field: "age",
      before: String(draft.age),
      after: decadeBucket(draft.age) ?? "—",
      reason: "exact_value_bucketed",
    });
  if (draft.tTG !== undefined)
    out.push({
      field: "tTG-IgA",
      before: `${draft.tTG} U/mL`,
      after: tTGBin(draft.tTG) ?? "—",
      reason: "exact_value_bucketed",
    });
  if (draft.iel !== undefined)
    out.push({
      field: "IEL count",
      before: `${draft.iel} / 100`,
      after: ielBin(draft.iel) ?? "—",
      reason: "exact_value_bucketed",
    });
  if (draft.gfdMonths !== undefined)
    out.push({
      field: "Months on GFD",
      before: `${draft.gfdMonths} months`,
      after: gfdBin(draft.gfdMonths) ?? "—",
      reason: "exact_value_bucketed",
    });
  if ((draft.notes ?? "").trim().length > 0) {
    out.push({
      field: "Clinician notes",
      before:
        draft.notes!.length > 60 ? draft.notes!.slice(0, 57) + "..." : draft.notes!,
      after: "(dropped)",
      reason: "free_text_dropped",
    });
  }
  return out;
}
