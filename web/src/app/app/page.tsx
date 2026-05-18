"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Stethoscope,
  Activity,
  ShieldAlert,
  Sparkles,
  FileText,
  HeartHandshake,
  Check,
  Mic,
  CircleDot,
  AlertTriangle,
  CheckCircle2,
  Info,
  RotateCcw,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { cn } from "@/lib/cn";
import { scoreConfidence, type ConfidenceResult } from "@/lib/confidence";
import type {
  AncestryBucket,
  DiagnosisState,
  LayerId,
  SexBucket,
} from "@/lib/layers";
import {
  ETHNICITY_LABELS,
  RED_FLAGS,
  type Ethnicity,
  type ScreenState,
  type Sex,
  type TwinState,
} from "@/lib/forms";
import { GemmaDictate } from "@/components/GemmaDictate";
import { TwinRun } from "@/components/TwinRun";
import { ScreenPrefillBar, TwinPrefillBar } from "@/components/PrefillBar";
import { MarshTile } from "@/components/MarshTile";
import { ContributePanel } from "@/components/ContributePanel";
import { PatientsPanel } from "@/components/PatientsPanel";
import type { TwinInputPayload, TwinResponse } from "@/lib/twin";

/* ------------------------------------------------------------------ */
/* Types & state                                                       */
/* ------------------------------------------------------------------ */

type Stage =
  | "mode"
  | "screen-input"
  | "screen-result"
  | "twin-input"
  | "twin-profile"
  | "twin-result"
  | "twin-gap"
  | "contribute"
  | "done";


/* ------------------------------------------------------------------ */
/* Mock logic                                                          */
/* ------------------------------------------------------------------ */

function riskFromFlags(n: number): {
  level: "low" | "moderate" | "moderate-high" | "high";
  label: string;
  prob: string;
} {
  if (n >= 5)
    return { level: "high", label: "High", prob: "pre-test probability ≥ 30%" };
  if (n >= 3)
    return {
      level: "moderate-high",
      label: "Moderate–High",
      prob: "pre-test probability 15–30%",
    };
  if (n >= 1)
    return {
      level: "moderate",
      label: "Moderate",
      prob: "pre-test probability 5–15%",
    };
  return {
    level: "low",
    label: "Low",
    prob: "pre-test probability < 5%",
  };
}

function needsTTGAdvisory(ethnicity: Ethnicity): boolean {
  return ethnicity === "african" || ethnicity === "black-caribbean";
}

/*
 * Thin adapter around `scoreConfidence` — maps the wizard's loose form state
 * (possibly-empty strings, ethnicity/sex unions) into the PatientProfile the
 * data-driven scorer consumes. See `web/src/lib/confidence.ts` for the axes.
 */
function buildConfidence(
  ethnicity: Ethnicity,
  sex: Sex,
  ageStr: string,
  entry: "screen" | "twin" | null,
  gfdMonthsStr: string,
) {
  const age = ageStr ? Number(ageStr) : undefined;
  const ancestry: AncestryBucket = ethnicity === "" ? "unknown" : ethnicity;
  const sexBucket: SexBucket | undefined =
    sex === "" ? undefined : (sex as SexBucket);

  let diagnosisState: DiagnosisState | undefined;
  if (entry === "screen") diagnosisState = "pre-diagnosis";
  else if (entry === "twin") {
    const gfd = gfdMonthsStr ? Number(gfdMonthsStr) : 0;
    diagnosisState = gfd > 0 ? "on-gfd" : "pre-diagnosis";
  }

  return scoreConfidence({
    age: age !== undefined && !Number.isNaN(age) ? age : undefined,
    sex: sexBucket,
    ancestry,
    diagnosisState,
  });
}

function buildTwinPayload(
  screen: ScreenState,
  twin: TwinState,
): TwinInputPayload {
  const p: TwinInputPayload = {};
  if (screen.age) {
    const n = Number(screen.age);
    if (!Number.isNaN(n)) p.age = n;
  }
  if (screen.sex) p.sex = screen.sex as TwinInputPayload["sex"];
  if (screen.ethnicity) p.ancestry = screen.ethnicity;
  if (twin.hla) p.hla = twin.hla as TwinInputPayload["hla"];
  if (twin.marsh) p.marsh = twin.marsh as TwinInputPayload["marsh"];
  if (twin.tTG) {
    const n = Number(twin.tTG);
    if (!Number.isNaN(n)) p.tTG = n;
  }
  if (twin.ema) p.ema = twin.ema as TwinInputPayload["ema"];
  if (twin.iel) {
    const n = Number(twin.iel);
    if (!Number.isNaN(n)) p.iel = n;
  }
  if (twin.gfdMonths) {
    const n = Number(twin.gfdMonths);
    if (!Number.isNaN(n)) p.gfdMonths = n;
  }
  const flags = Object.entries(screen.flags)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (flags.length) p.flags = flags;
  if (twin.notes) p.notes = twin.notes;
  return p;
}

function marshProjection(input: TwinState): {
  from: string;
  to: string;
} | null {
  if (!input.marsh || input.marsh === "0") return null;
  const map: Record<string, string> = {
    "1": "0",
    "2": "0",
    "3a": "1",
    "3b": "1",
    "3c": "2",
  };
  return { from: input.marsh, to: map[input.marsh] ?? "1" };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "gluten.session.v1";

type PersistedSession = {
  stage: Stage;
  entry: "screen" | "twin" | null;
  screen: ScreenState;
  twin: TwinState;
};

function loadSession(): Partial<PersistedSession> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

export default function AppPage() {
  // Lazy initialisers read from localStorage on first render so the session
  // survives refreshes and tab restores. Writes are debounced via a single
  // effect below.
  const [stage, setStage] = useState<Stage>(
    () => (loadSession()?.stage as Stage | undefined) ?? "mode",
  );
  const [entry, setEntry] = useState<"screen" | "twin" | null>(
    () => loadSession()?.entry ?? null,
  );

  const [screen, setScreen] = useState<ScreenState>(
    () =>
      loadSession()?.screen ?? {
        age: "",
        sex: "",
        ethnicity: "",
        flags: {},
      },
  );
  const [twin, setTwin] = useState<TwinState>(
    () =>
      loadSession()?.twin ?? {
        tTG: "",
        ema: "",
        hla: "",
        marsh: "",
        iel: "",
        gfdMonths: "",
        notes: "",
      },
  );

  // Bumped after each successful contribution so the Patients panel
  // re-fetches the latest list without a hard reload.
  const [contributionsRefreshKey, setContributionsRefreshKey] = useState(0);

  // Persist on any change. Writes are tiny (<2 KB JSON) so we don't need
  // throttling. Synchronous so the user can refresh immediately after
  // any keystroke and still see their data.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ stage, entry, screen, twin }),
      );
    } catch {
      // Quota exceeded or private mode — just skip.
    }
  }, [stage, entry, screen, twin]);

  const flagCount = useMemo(
    () => Object.values(screen.flags).filter(Boolean).length,
    [screen.flags],
  );
  const risk = useMemo(() => riskFromFlags(flagCount), [flagCount]);
  const advisory = needsTTGAdvisory(screen.ethnicity);
  const conf = useMemo(
    () =>
      buildConfidence(
        screen.ethnicity,
        screen.sex,
        screen.age,
        entry,
        twin.gfdMonths,
      ),
    [screen.ethnicity, screen.sex, screen.age, entry, twin.gfdMonths],
  );
  const marsh = useMemo(() => marshProjection(twin), [twin]);

  const reset = () => {
    setStage("mode");
    setEntry(null);
    setScreen({ age: "", sex: "", ethnicity: "", flags: {} });
    setTwin({
      tTG: "",
      ema: "",
      hla: "",
      marsh: "",
      iel: "",
      gfdMonths: "",
      notes: "",
    });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader />

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[260px_1fr]">
        {/* Progress rail */}
        <aside className="hidden lg:block">
          <ProgressRail
            stage={stage}
            entry={entry}
            onReset={reset}
            onJump={(s) => setStage(s)}
            contributionsRefreshKey={contributionsRefreshKey}
          />
        </aside>

        <main className="min-w-0">
          <MobileProgress stage={stage} entry={entry} />

          <AnimatePresence mode="wait">
            {stage === "mode" && (
              <StagePanel key="mode">
                <ModeSelect
                  onPick={(mode) => {
                    setEntry(mode);
                    setStage(mode === "screen" ? "screen-input" : "twin-input");
                  }}
                />
              </StagePanel>
            )}

            {stage === "screen-input" && (
              <StagePanel key="screen-input">
                <ScreenInput
                  state={screen}
                  onChange={setScreen}
                  flagCount={flagCount}
                  onBack={() => setStage("mode")}
                  onNext={() => setStage("screen-result")}
                />
              </StagePanel>
            )}

            {stage === "screen-result" && (
              <StagePanel key="screen-result">
                <ScreenResult
                  state={screen}
                  flagCount={flagCount}
                  risk={risk}
                  advisory={advisory}
                  onBack={() => setStage("screen-input")}
                  onOrderTests={() => setStage("twin-input")}
                  onDone={reset}
                />
              </StagePanel>
            )}

            {stage === "twin-input" && (
              <StagePanel key="twin-input">
                <TwinInput
                  state={twin}
                  onChange={setTwin}
                  screenState={screen}
                  onScreenChange={setScreen}
                  fromScreen={entry === "screen"}
                  onBack={() =>
                    setStage(entry === "screen" ? "screen-result" : "mode")
                  }
                  onNext={() => setStage("twin-profile")}
                />
              </StagePanel>
            )}

            {stage === "twin-profile" && (
              <StagePanel key="twin-profile">
                <TwinProfile
                  twin={twin}
                  screen={screen}
                  onBack={() => setStage("twin-input")}
                  onNext={() => setStage("twin-result")}
                />
              </StagePanel>
            )}

            {stage === "twin-result" && (
              <StagePanel key="twin-result">
                <TwinResult
                  twin={twin}
                  screen={screen}
                  conf={conf}
                  marsh={marsh}
                  onBack={() => setStage("twin-profile")}
                  onNext={() => setStage("twin-gap")}
                />
              </StagePanel>
            )}

            {stage === "twin-gap" && (
              <StagePanel key="twin-gap">
                <TwinGap
                  screen={screen}
                  conf={conf}
                  onBack={() => setStage("twin-result")}
                  onNext={() => setStage("contribute")}
                />
              </StagePanel>
            )}

            {stage === "contribute" && (
              <StagePanel key="contribute">
                <Contribute
                  screen={screen}
                  twin={twin}
                  onBack={() => setStage("twin-gap")}
                  onSubmit={() => {
                    setContributionsRefreshKey((k) => k + 1);
                    setStage("done");
                  }}
                  onSkip={() => setStage("done")}
                />
              </StagePanel>
            )}

            {stage === "done" && (
              <StagePanel key="done">
                <Done onReset={reset} />
              </StagePanel>
            )}
          </AnimatePresence>

          <DisclaimerFooter />
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell: wrapping animation & progress rail                           */
/* ------------------------------------------------------------------ */

function StagePanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

const RAIL_STEPS: { stages: Stage[]; label: string; step: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { stages: ["mode"], label: "Start", step: "00", icon: CircleDot },
  {
    stages: ["screen-input", "screen-result"],
    label: "Screen",
    step: "Screen · 0",
    icon: Stethoscope,
  },
  { stages: ["twin-input"], label: "Input", step: "Twin · 1", icon: Mic },
  {
    stages: ["twin-profile"],
    label: "FHIR profile",
    step: "Twin · 2",
    icon: FileText,
  },
  {
    stages: ["twin-result"],
    label: "Simulation",
    step: "Twin · 3",
    icon: Sparkles,
  },
  {
    stages: ["twin-gap"],
    label: "Gap report",
    step: "Twin · 4",
    icon: Activity,
  },
  {
    stages: ["contribute", "done"],
    label: "Contribute",
    step: "Twin · 5",
    icon: HeartHandshake,
  },
];

function ProgressRail({
  stage,
  entry,
  onReset,
  onJump,
  contributionsRefreshKey,
}: {
  stage: Stage;
  entry: "screen" | "twin" | null;
  onReset: () => void;
  onJump: (stage: Stage) => void;
  contributionsRefreshKey: number;
}) {
  const activeIdx = RAIL_STEPS.findIndex((s) => s.stages.includes(stage));
  return (
    <div className="sticky top-28">
      <div className="mb-5 font-mono text-[11px] uppercase tracking-widest text-warm">
        Current patient session
      </div>
      <div className="rounded-3xl border border-line bg-cream p-4">
        <ol className="space-y-1">
          {RAIL_STEPS.map((s, i) => {
            const active = i === activeIdx;
            const done = i < activeIdx;
            const skipped =
              s.label === "Screen" && entry === "twin" && activeIdx > 0;
            // Reached = either active or behind the current furthest step.
            // We only allow jumping to reached steps so users don't skip
            // forward into stages whose data isn't gathered yet.
            const reached = i <= activeIdx && !skipped;
            const Tag = reached ? "button" : "div";
            return (
              <li key={s.label}>
                <Tag
                  onClick={
                    reached
                      ? () => onJump(s.stages[0])
                      : undefined
                  }
                  type={reached ? "button" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    active && "bg-wheat-pale text-deep",
                    !active && done && "text-warm hover:bg-wheat-pale/60 hover:text-deep",
                    !active && !done && "text-warm/70",
                    skipped && "opacity-40",
                    reached && !active && "cursor-pointer",
                    !reached && "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px]",
                      active
                        ? "border-wheat bg-wheat text-deep"
                        : done
                          ? "border-safe/40 bg-safe/10 text-safe"
                          : "border-line bg-cream text-warm/60",
                    )}
                  >
                    {done ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      String(i).padStart(2, "0")
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-widest text-warm/70">
                      {s.step}
                    </div>
                    <div className="truncate text-[13px]">{s.label}</div>
                  </div>
                  <s.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-wheat-deep" : "text-warm/40",
                    )}
                  />
                </Tag>
              </li>
            );
          })}
        </ol>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 w-full rounded-full border border-line bg-cream px-4 py-2 text-xs text-warm transition hover:border-deep/30 hover:text-deep"
      >
        Reset session
      </button>

      <PatientsPanel refreshKey={contributionsRefreshKey} />
    </div>
  );
}

function MobileProgress({
  stage,
  entry,
}: {
  stage: Stage;
  entry: "screen" | "twin" | null;
}) {
  const activeIdx = RAIL_STEPS.findIndex((s) => s.stages.includes(stage));
  const total = RAIL_STEPS.length - 1;
  const pct = Math.max(0, Math.min(100, (activeIdx / total) * 100));
  return (
    <div className="mb-6 lg:hidden">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-warm">
        <span>{RAIL_STEPS[Math.max(0, activeIdx)]?.step ?? "Start"}</span>
        <span>
          {entry ? (entry === "screen" ? "Screen mode" : "Twin mode") : "—"}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-wheat transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DisclaimerFooter() {
  return (
    <div className="mt-12 rounded-2xl border border-line bg-cream/60 p-4 text-[11px] leading-relaxed text-warm">
      <Info className="mb-1 inline h-3 w-3 text-wheat-deep" /> Glüten is a
      research prototype and clinical decision-support tool. Outputs are
      model-based extrapolations of published evidence — never diagnoses. The
      clinician remains responsible for all testing and management decisions,
      under their existing institutional governance.
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage: Mode select                                                  */
/* ------------------------------------------------------------------ */

function ModeSelect({
  onPick,
}: {
  onPick: (m: "screen" | "twin") => void;
}) {
  return (
    <div>
      <div className="mb-8 max-w-2xl">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-widest text-warm">
          Step 00 · Start a session
        </div>
        <h1 className="serif text-4xl leading-tight text-deep sm:text-5xl">
          One app. Two entry points.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-warm">
          Screen a patient with non-specific symptoms, or go straight to the
          twin with confirmed coeliac data. Both paths meet at the same
          six-layer disease model.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onPick("screen")}
          className="group relative overflow-hidden rounded-3xl border border-wheat/40 bg-gradient-to-br from-wheat-pale to-cream p-7 text-left transition hover:border-wheat hover:shadow-[0_40px_80px_-40px_rgba(212,168,67,0.4)]"
        >
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-wheat/20 text-wheat-deep ring-1 ring-wheat/40">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-wheat-deep">
            Screen mode · Step 00
          </div>
          <h2 className="serif mt-1 text-2xl text-deep">
            Should I test this patient?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-warm">
            Non-specific symptoms: chronic anaemia, fatigue, IBS label, bone
            loss, infertility. Get a bias-aware recommendation on whether to
            order coeliac testing.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-deep transition group-hover:gap-3">
            Begin screening
            <ArrowRight className="h-4 w-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onPick("twin")}
          className="group relative overflow-hidden rounded-3xl border border-line bg-cream p-7 text-left transition hover:border-deep/30 hover:shadow-[0_40px_80px_-40px_rgba(45,42,36,0.35)]"
        >
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-deep text-cream">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-warm">
            Twin mode · Step 01
          </div>
          <h2 className="serif mt-1 text-2xl text-deep">
            Project this patient&apos;s trajectory.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-warm">
            You already have serology, HLA typing, or a biopsy. Skip screening,
            enter what you have, and run the six-layer twin for a projection
            with per-layer confidence.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-deep transition group-hover:gap-3">
            Open the twin
            <ArrowRight className="h-4 w-4" />
          </div>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage: Screen input                                                 */
/* ------------------------------------------------------------------ */

function ScreenInput({
  state,
  onChange,
  flagCount,
  onBack,
  onNext,
}: {
  state: ScreenState;
  onChange: (s: ScreenState) => void;
  flagCount: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const toggleFlag = (id: string) =>
    onChange({ ...state, flags: { ...state.flags, [id]: !state.flags[id] } });

  // Show the clear button only when there's something to clear.
  const hasContent =
    state.age !== "" ||
    state.sex !== "" ||
    state.ethnicity !== "" ||
    Object.values(state.flags ?? {}).some(Boolean);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <SectionHeader
          step="Screen · Step 00"
          title="Enter non-specific symptoms"
          blurb="Check every red-flag signal present. You do not need a coeliac-specific test yet — this is the pre-diagnostic entry point."
        />
        {hasContent && (
          <button
            type="button"
            onClick={() =>
              onChange({ age: "", sex: "", ethnicity: "", flags: {} })
            }
            className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-cream px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-warm transition hover:border-deep/40 hover:text-deep"
          >
            <RotateCcw className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      <ScreenPrefillBar onApply={onChange} />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <GemmaDictate<ScreenState>
            mode="screen"
            placeholder="e.g. 28-year-old Black woman, chronic iron deficiency anaemia for two years unresponsive to supplementation, persistent fatigue, IBS diagnosis last year, mother has Hashimoto's thyroiditis."
            onApply={(patch) =>
              onChange({
                ...state,
                ...patch,
                flags: { ...state.flags, ...(patch.flags ?? {}) },
              })
            }
          />
          {/* Demographics */}
          <Card>
            <CardTitle>Patient demographics</CardTitle>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Age">
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={state.age}
                  onChange={(e) => onChange({ ...state, age: e.target.value })}
                  placeholder="e.g. 28"
                  className={inputClass}
                />
              </Field>
              <Field label="Sex">
                <select
                  value={state.sex}
                  onChange={(e) =>
                    onChange({ ...state, sex: e.target.value as Sex })
                  }
                  className={inputClass}
                >
                  <option value="">—</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other / prefer not to say</option>
                </select>
              </Field>
              <Field label="Ethnicity">
                <select
                  value={state.ethnicity}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      ethnicity: e.target.value as Ethnicity,
                    })
                  }
                  className={inputClass}
                >
                  {Object.entries(ETHNICITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {needsTTGAdvisory(state.ethnicity) && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-wheat/40 bg-wheat/5 p-3 text-[12px] text-deep">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-wheat-deep" />
                Standard tTG-IgA serology has higher false-negative rates in
                this population. Glüten will adjust its testing advisory.
              </div>
            )}
          </Card>

          {/* Symptoms */}
          <Card>
            <div className="flex items-baseline justify-between gap-4">
              <CardTitle>Red-flag signals</CardTitle>
              <div className="font-mono text-[11px] text-warm">
                {flagCount} selected
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {RED_FLAGS.map((f) => {
                const checked = !!state.flags[f.id];
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFlag(f.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                      checked
                        ? "border-wheat bg-wheat-pale"
                        : "border-line bg-cream hover:border-deep/30",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border",
                        checked
                          ? "border-wheat-deep bg-wheat-deep text-cream"
                          : "border-line bg-cream",
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span>
                      <span className="block text-[13px] leading-tight text-deep">
                        {f.label}
                      </span>
                      {f.hint && (
                        <span className="mt-1 block text-[11px] text-warm">
                          {f.hint}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Running summary */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-line bg-cream p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-warm">
              Running summary
            </div>
            <div className="mt-3 space-y-3 text-sm">
              <SummaryRow
                label="Age / sex"
                value={
                  state.age
                    ? `${state.age} · ${state.sex ? state.sex : "—"}`
                    : "—"
                }
              />
              <SummaryRow
                label="Ethnicity"
                value={ETHNICITY_LABELS[state.ethnicity]}
              />
              <SummaryRow
                label="Red flags"
                value={`${flagCount} selected`}
              />
            </div>
            <div className="mt-5 border-t border-line pt-4 text-[12px] text-warm">
              Guideline basis: ACG 2023 · BSG 2014 · ESsCD 2025. Risk levels are
              pre-test probability ranges, not diagnoses.
            </div>
          </div>
        </aside>
      </div>

      <StageNav onBack={onBack} onNext={onNext} nextLabel="Run screening" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage: Screen result                                                */
/* ------------------------------------------------------------------ */

function ScreenResult({
  state,
  flagCount,
  risk,
  advisory,
  onBack,
  onOrderTests,
  onDone,
}: {
  state: ScreenState;
  flagCount: number;
  risk: ReturnType<typeof riskFromFlags>;
  advisory: boolean;
  onBack: () => void;
  onOrderTests: () => void;
  onDone: () => void;
}) {
  const toneByLevel = {
    low: "border-line bg-cream text-deep",
    moderate: "border-info/30 bg-info/5 text-deep",
    "moderate-high": "border-wheat/50 bg-wheat-pale text-deep",
    high: "border-alert/40 bg-alert/5 text-deep",
  }[risk.level];

  return (
    <div>
      <SectionHeader
        step="Screen · result"
        title="Bias-aware coeliac probability"
        blurb="Risk levels map pre-test probability from selected red-flag clusters. This is a structured prompt to the clinician, never a diagnosis."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main result */}
        <div className="space-y-5">
          <div className={cn("rounded-3xl border p-7", toneByLevel)}>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-warm">
              <CircleDot className="h-3 w-3" />
              Probability
            </div>
            <div className="mt-2 flex items-end justify-between gap-6">
              <div>
                <div className="serif text-4xl sm:text-5xl">{risk.label}</div>
                <div className="mt-1 text-sm text-warm">{risk.prob}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[11px] uppercase tracking-widest text-warm">
                  Red flags
                </div>
                <div className="serif text-3xl">{flagCount}</div>
              </div>
            </div>
          </div>

          {/* Recommended next step */}
          <Card>
            <CardTitle>Recommended next step</CardTitle>
            {risk.level === "low" ? (
              <p className="mt-3 text-[14px] leading-relaxed text-warm">
                No red-flag cluster detected. If clinical suspicion remains on
                other grounds, consider tTG-IgA + total IgA as a baseline — per
                BSG 2014 guidance.
              </p>
            ) : (
              <p className="mt-3 text-[14px] leading-relaxed text-deep">
                Order <strong>tTG-IgA + total IgA</strong> serology. If IgA
                deficient, use IgG-based serology (DGP or tTG-IgG).
              </p>
            )}

            {advisory && risk.level !== "low" && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-wheat/40 bg-wheat/5 p-4">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-wheat-deep" />
                <div className="text-[13px] leading-relaxed text-deep">
                  <div className="font-medium">
                    Demographic-aware test advisory
                  </div>
                  <p className="mt-1 text-warm">
                    tTG-IgA has higher published false-negative rates in Black
                    patients (PMC11308727). If serology is negative but clinical
                    suspicion remains, consider <strong>EMA testing</strong> or{" "}
                    <strong>direct duodenal biopsy referral</strong> rather than
                    discharging.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              {state.ethnicity && (
                <Tag>{ETHNICITY_LABELS[state.ethnicity]}</Tag>
              )}
              {state.age && <Tag>Age {state.age}</Tag>}
              {state.sex && <Tag className="capitalize">{state.sex}</Tag>}
              <Tag>{flagCount} red-flag signals</Tag>
            </div>
          </Card>

          <Card>
            <CardTitle>What Glüten matched against</CardTitle>
            <ul className="mt-3 space-y-2 text-[13px] text-warm">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-safe" />
                ACG 2023 — Diagnosis and Management of Celiac Disease
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-safe" />
                BSG 2014 — Adult coeliac disease guideline
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-safe" />
                ESsCD 2025 — Updated diagnostic approach
              </li>
              {advisory && (
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-safe" />
                  PMC11308727 — tTG-IgA performance in Black patients
                </li>
              )}
            </ul>
          </Card>
        </div>

        {/* Next actions */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-line bg-cream p-5">
            <CardTitle>Next in this session</CardTitle>
            <p className="mt-2 text-[13px] text-warm">
              When results come back, run the full disease twin. Glüten will
              carry this patient&apos;s demographics through.
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={onOrderTests}
                className="inline-flex w-full items-center justify-between gap-2 rounded-full bg-deep px-5 py-3 text-sm text-cream transition hover:bg-charcoal"
              >
                I have test results — run the twin
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDone}
                className="w-full rounded-full border border-line bg-cream px-5 py-3 text-sm text-warm transition hover:border-deep/30 hover:text-deep"
              >
                End session for this patient
              </button>
            </div>
          </div>
        </aside>
      </div>

      <StageNav onBack={onBack} hideNext />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage: Twin input                                                   */
/* ------------------------------------------------------------------ */

function TwinInput({
  state,
  onChange,
  screenState,
  onScreenChange,
  fromScreen,
  onBack,
  onNext,
}: {
  state: TwinState;
  onChange: (s: TwinState) => void;
  screenState: ScreenState;
  onScreenChange: (s: ScreenState) => void;
  fromScreen: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <SectionHeader
        step="Twin · Step 01"
        title="Enter what you have"
        blurb="Partial data is fine. Only the layers you populate will activate. Voice input on-device (Gemma 4 E4B via Ollama) in the full build — this prototype uses the same structured schema."
      />

      {fromScreen && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-wheat/30 bg-wheat/5 p-4 text-[13px] text-deep">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-wheat-deep" />
          Carrying over demographics from screening:
          <span className="ml-1 font-medium">
            {screenState.age && `${screenState.age}y, `}
            {screenState.sex && `${screenState.sex}, `}
            {ETHNICITY_LABELS[screenState.ethnicity]}
          </span>
        </div>
      )}

      <TwinPrefillBar
        onApply={(t, demo) => {
          onChange(t);
          if (demo) onScreenChange({ ...screenState, ...demo });
        }}
      />

      <div className="mb-5">
        <GemmaDictate<TwinState>
          mode="twin"
          placeholder="e.g. Mrs A, follow-up. tTG-IgA 84 U/mL, EMA positive. HLA-DQ2.5 homozygous. Duodenal biopsy Marsh 3b with IEL count of 42 per 100 enterocytes. Newly diagnosed, not yet on GFD. T1DM since age 12."
          onApply={(patch) => onChange({ ...state, ...patch })}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Serology</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="tTG-IgA (U/mL)">
              <input
                type="number"
                min={0}
                value={state.tTG}
                onChange={(e) => onChange({ ...state, tTG: e.target.value })}
                placeholder="e.g. 84"
                className={inputClass}
              />
            </Field>
            <Field label="EMA">
              <select
                value={state.ema}
                onChange={(e) =>
                  onChange({ ...state, ema: e.target.value as TwinState["ema"] })
                }
                className={inputClass}
              >
                <option value="">—</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="unknown">Not tested</option>
              </select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Genetics</CardTitle>
          <div className="mt-4">
            <Field label="HLA typing">
              <select
                value={state.hla}
                onChange={(e) =>
                  onChange({ ...state, hla: e.target.value as TwinState["hla"] })
                }
                className={inputClass}
              >
                <option value="">—</option>
                <option value="dq2.5">DQ2.5 positive</option>
                <option value="dq2.2">DQ2.2 positive</option>
                <option value="dq8">DQ8 positive</option>
                <option value="negative">DQ2/DQ8 negative</option>
                <option value="unknown">Not tested</option>
              </select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Histology</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Marsh score">
              <select
                value={state.marsh}
                onChange={(e) =>
                  onChange({
                    ...state,
                    marsh: e.target.value as TwinState["marsh"],
                  })
                }
                className={inputClass}
              >
                <option value="">—</option>
                <option value="0">0 — normal</option>
                <option value="1">1 — increased IEL</option>
                <option value="2">2 — crypt hyperplasia</option>
                <option value="3a">3a — partial villous atrophy</option>
                <option value="3b">3b — subtotal villous atrophy</option>
                <option value="3c">3c — total villous atrophy</option>
              </select>
            </Field>
            <Field label="IEL (per 100 enterocytes)">
              <input
                type="number"
                min={0}
                value={state.iel}
                onChange={(e) => onChange({ ...state, iel: e.target.value })}
                placeholder="e.g. 42"
                className={inputClass}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Management context</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Months on strict GFD">
              <input
                type="number"
                min={0}
                value={state.gfdMonths}
                onChange={(e) =>
                  onChange({ ...state, gfdMonths: e.target.value })
                }
                placeholder="0 = not yet started"
                className={inputClass}
              />
            </Field>
            <Field label="Clinician notes">
              <textarea
                rows={2}
                value={state.notes}
                onChange={(e) => onChange({ ...state, notes: e.target.value })}
                placeholder="Anything Gemma 4 should note (dictated in full build)"
                className={cn(inputClass, "resize-none")}
              />
            </Field>
          </div>
        </Card>
      </div>

      <StageNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Structure as FHIR profile"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage: Twin FHIR profile                                            */
/* ------------------------------------------------------------------ */

function TwinProfile({
  twin,
  screen,
  onBack,
  onNext,
}: {
  twin: TwinState;
  screen: ScreenState;
  onBack: () => void;
  onNext: () => void;
}) {
  const profile = {
    resourceType: "Patient",
    meta: {
      profile: ["https://glüten.app/fhir/StructureDefinition/coeliac-profile"],
      generatedBy: "Gemma 4 E4B (Ollama, on-device)",
    },
    identifier: [{ system: "gluten.session", value: "SESSION-LOCAL-ONLY" }],
    gender: screen.sex || undefined,
    age: screen.age ? Number(screen.age) : undefined,
    extension: [
      screen.ethnicity && {
        url: "ethnicity",
        valueString: ETHNICITY_LABELS[screen.ethnicity],
      },
    ].filter(Boolean),
    observations: [
      twin.tTG && {
        code: "tTG-IgA",
        value: Number(twin.tTG),
        unit: "U/mL",
        interpretation: Number(twin.tTG) > 10 ? "positive" : "negative",
      },
      twin.ema && { code: "EMA", value: twin.ema },
      twin.hla && { code: "HLA", value: twin.hla.toUpperCase() },
      twin.marsh && { code: "Marsh", value: twin.marsh },
      twin.iel && {
        code: "IEL",
        value: Number(twin.iel),
        unit: "per 100 enterocytes",
      },
      twin.gfdMonths && {
        code: "GFD-duration",
        value: Number(twin.gfdMonths),
        unit: "months",
      },
    ].filter(Boolean),
    note: twin.notes || undefined,
  };

  const activeLayers: string[] = [];
  if (twin.tTG || twin.ema) activeLayers.push("Clinical");
  if (twin.hla) activeLayers.push("Genomic");
  if (twin.marsh || twin.iel) activeLayers.push("Structural");
  if (twin.notes) activeLayers.push("Clinical");
  // always at least clinical if any screening context
  if (activeLayers.length === 0) activeLayers.push("Clinical");

  const uniqueLayers = Array.from(new Set(activeLayers));

  return (
    <div>
      <SectionHeader
        step="Twin · Step 02"
        title="FHIR-compatible profile"
        blurb="Gemma 4 E4B structures the input into a de-identified profile card. No patient identifiers are retained — only structured clinical data."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-cream/60 px-5 py-3">
            <div className="font-mono text-[11px] uppercase tracking-widest text-warm">
              Profile.json
            </div>
            <div className="font-mono text-[10px] text-warm/70">
              structured by Gemma 4 E4B · on-device
            </div>
          </div>
          <pre className="overflow-x-auto bg-deep p-5 font-mono text-[12px] leading-relaxed text-cream/90">
            {JSON.stringify(profile, null, 2)}
          </pre>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-line bg-cream p-5">
            <CardTitle>Layers activated</CardTitle>
            <p className="mt-2 text-[12px] text-warm">
              Only dimensions with provided data will be queried against the
              disease model.
            </p>
            <div className="mt-4 grid gap-2">
              {[
                "Molecular",
                "Structural",
                "Clinical",
                "Microbiome",
                "Longitudinal",
                "Genomic",
              ].map((l) => {
                const on = uniqueLayers.includes(l);
                return (
                  <div
                    key={l}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-[13px]",
                      on
                        ? "border-wheat/60 bg-wheat-pale text-deep"
                        : "border-line bg-cream text-warm/70",
                    )}
                  >
                    <span>{l}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest">
                      {on ? "active" : "no data"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-8">
        <MarshTile />
      </div>

      <StageNav onBack={onBack} onNext={onNext} nextLabel="Run the twin" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage: Twin result (simulation + confidence)                        */
/* ------------------------------------------------------------------ */

function TwinResult({
  twin,
  screen,
  conf,
  marsh,
  onBack,
  onNext,
}: {
  twin: TwinState;
  screen: ScreenState;
  conf: ConfidenceResult;
  marsh: ReturnType<typeof marshProjection>;
  onBack: () => void;
  onNext: () => void;
}) {
  const layers: {
    key: LayerId;
    name: string;
    note: string;
    source: string;
  }[] = [
    {
      key: "molecular",
      name: "Molecular",
      note: "Transcriptomic panel",
      source: "GSE164883",
    },
    {
      key: "structural",
      name: "Structural",
      note: "WSI histopathology",
      source: "IBDColEpi + Cambridge",
    },
    {
      key: "clinical",
      name: "Clinical",
      note: "Serology, symptoms, HLA",
      source: "Kaggle CD Dataset",
    },
    {
      key: "microbiome",
      name: "Microbiome",
      note: "Fecal metaproteome",
      source: "PMC12877843",
    },
    {
      key: "longitudinal",
      name: "Longitudinal",
      note: "TCR repertoires over time",
      source: "PMC7898595",
    },
    {
      key: "genomic",
      name: "Genomic",
      note: "HLA + ~200 SNP risk score",
      source: "PMC3923679",
    },
  ];

  const confColor = (v: number) =>
    v >= 0.7 ? "bg-safe" : v >= 0.4 ? "bg-wheat" : "bg-alert/80";
  const overallColor =
    conf.overall >= 0.7
      ? "text-safe"
      : conf.overall >= 0.4
        ? "text-wheat-deep"
        : "text-alert";

  // Shared twin-engine result, consumed by both the top projection
  // card (headline / trajectory numbers) and the <TwinRun> below.
  // While null, the top card shows deterministic heuristic placeholders
  // — clearly labelled as such. Once Gemma returns, the heuristic values
  // are REPLACED by the model's grounded projection and the label
  // switches to "grounded in retrieved literature".
  const [twinResult, setTwinResult] = useState<TwinResponse | null>(null);

  const tTGHeuristic = twin.tTG ? Math.max(8, Math.round(Number(twin.tTG) * 0.22)) : null;
  const g = twinResult?.generation.overall;
  const grounded = Boolean(twinResult);

  const marshLine = g?.marshTrajectory
    ? `Marsh ${g.marshTrajectory}`
    : marsh
      ? `Marsh ${marsh.from} → ${marsh.to}`
      : "Stable serology on strict GFD";

  const tTGLine = g?.tTGTrajectory
    ? `tTG ${g.tTGTrajectory}`
    : tTGHeuristic !== null
      ? `tTG ${twin.tTG} → <${tTGHeuristic}`
      : null;

  const ielLine = g?.ielTrajectory
    ? `IEL ${g.ielTrajectory}`
    : twin.iel
      ? `IEL ${twin.iel} → <25 per 100 enterocytes`
      : null;

  return (
    <div>
      <SectionHeader
        step="Twin · Step 03"
        title="Personalised projection"
        blurb="Gemma 4 31B cross-references the profile against six layers of the coeliac disease model. The prediction is the product. The confidence flag is the bonus."
      />

      <div className="rounded-3xl border border-charcoal/80 bg-deep p-6 text-cream shadow-[0_40px_100px_-40px_rgba(0,0,0,0.6)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-widest text-wheat">
              <span className="h-1.5 w-1.5 rounded-full bg-wheat" />
              6-month strict gluten-free trajectory
            </div>
            <h3 className="serif text-2xl sm:text-3xl">
              {grounded && g?.headline ? g.headline : marshLine}
            </h3>
            {grounded && g?.headline && (
              <p className="mt-1 font-mono text-[12px] text-wheat/90">{marshLine}</p>
            )}
            <p className="mt-2 text-sm text-cream/70">
              {ETHNICITY_LABELS[screen.ethnicity] || "Demographic not set"}
              {screen.age ? ` · ${screen.age}y` : ""}
              {screen.sex ? ` · ${screen.sex}` : ""}
              {twin.hla ? ` · HLA ${twin.hla.toUpperCase()}` : ""}
              {twin.marsh ? ` · Marsh ${twin.marsh}` : ""}
              {twin.tTG ? ` · tTG ${twin.tTG}` : ""}
            </p>
            {(tTGLine || ielLine) && (
              <p className="mt-2 font-mono text-sm text-wheat">
                {tTGLine}
                {tTGLine && ielLine && " · "}
                {ielLine}
              </p>
            )}
            <div
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] uppercase tracking-widest",
                grounded
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-wheat/30 bg-wheat/5 text-wheat/80",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  grounded ? "bg-emerald-400" : "bg-wheat",
                )}
              />
              {grounded
                ? "grounded in retrieved literature · Gemma 4 31B"
                : "heuristic preview · run the twin engine for the evidence-grounded projection"}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-widest text-cream/50">
              Overall confidence
            </div>
            <div className={cn("serif text-4xl", overallColor)}>
              {conf.overall.toFixed(2)}
            </div>
            <div className="text-[11px] text-cream/60">
              demographic match: {conf.match.toLowerCase()}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {layers.map((l) => {
            const v = conf.layers[l.key];
            return (
              <div
                key={l.name}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-cream">{l.name}</span>
                  <span className="font-mono text-sm tabular-nums text-wheat">
                    {v.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full", confColor(v))}
                    style={{ width: `${v * 100}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-cream/50">
                  <span>{l.note}</span>
                  <span className="font-mono text-wheat/70">{l.source}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-wheat/30 bg-wheat/5 p-4 text-[13px] leading-relaxed text-wheat/90">
          The projection assumes strict adherence to a gluten-free diet.
          Confidence reflects how much of the disease model was trained on
          profiles matching this patient&apos;s demographic and clinical
          context.
        </div>
      </div>

      <TwinRun
        payload={buildTwinPayload(screen, twin)}
        result={twinResult}
        onResult={setTwinResult}
      />

      <StageNav onBack={onBack} onNext={onNext} nextLabel="See evidence gaps" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage: Twin gap report                                              */
/* ------------------------------------------------------------------ */

function TwinGap({
  screen,
  conf,
  onBack,
  onNext,
}: {
  screen: ScreenState;
  conf: ConfidenceResult;
  onBack: () => void;
  onNext: () => void;
}) {
  const layers = Object.entries(conf.layers) as [LayerId, number][];
  const strong = layers.filter(([, v]) => v >= 0.6);
  const thin = layers.filter(([, v]) => v < 0.4);
  const partial = layers.filter(([, v]) => v >= 0.4 && v < 0.6);

  return (
    <div>
      <SectionHeader
        step="Twin · Step 04"
        title="Evidence gap report"
        blurb="A clinician-facing summary of where the disease model was built for this patient — and where it wasn't."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <GapStat
          tone="safe"
          heading={`${strong.length} of 6 layers`}
          sub="strong evidence"
          detail={strong.map(([k]) => capitalise(k)).join(" · ") || "—"}
        />
        <GapStat
          tone="wheat"
          heading={`${partial.length} of 6 layers`}
          sub="partial evidence"
          detail={partial.map(([k]) => capitalise(k)).join(" · ") || "—"}
        />
        <GapStat
          tone="alert"
          heading={`${thin.length} of 6 layers`}
          sub="thin or near-zero"
          detail={thin.map(([k]) => capitalise(k)).join(" · ") || "—"}
        />
      </div>

      <div className="mt-6">
        <Card>
          <CardTitle>Clinician summary</CardTitle>
          <p className="mt-3 text-[14px] leading-relaxed text-warm">
            {narrativeFor(conf, screen.ethnicity)}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-wheat-pale/50 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-warm">
                For this consultation
              </div>
              <ul className="mt-2 space-y-1.5 text-[13px] text-deep">
                <li className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-wheat-deep" />
                  Treat the trajectory projection as a starting point for
                  shared decision-making, not a fixed clinical outcome.
                </li>
                <li className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-wheat-deep" />
                  Follow-up serology and symptoms should be monitored on the
                  usual schedule — the model does not replace surveillance.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-line bg-wheat-pale/50 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-warm">
                For the field
              </div>
              <ul className="mt-2 space-y-1.5 text-[13px] text-deep">
                <li className="flex gap-2">
                  <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-wheat-deep" />
                  Aggregated across patients, thin layers point research
                  prioritisation — this is where new data collection is needed.
                </li>
                <li className="flex gap-2">
                  <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-wheat-deep" />
                  Your next contribution (opt-in, next step) moves the needle
                  on exactly these gaps.
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <StageNav onBack={onBack} onNext={onNext} nextLabel="Contribute (opt-in)" />
    </div>
  );
}

function narrativeFor(
  conf: ConfidenceResult,
  ethnicity: Ethnicity,
): string {
  const demo = ETHNICITY_LABELS[ethnicity] || "this demographic";
  if (conf.match === "LOW")
    return `The disease model had strong coverage in structural histology and clinical serology, but near-zero representation for ${demo} in the microbiome and longitudinal layers. The projection above extrapolates from European cohort data — treat it as a directional prior, not a calibrated probability, until local evidence accrues.`;
  if (conf.match === "PARTIAL")
    return `Coverage for ${demo} is partial. The structural and clinical layers carry most of the signal; the microbiome and longitudinal layers are underpowered. The projection is more reliable on histology recovery than on longer-term mucosal or immune dynamics.`;
  return `Coverage for ${demo} is strong across most layers. Microbiome and longitudinal dimensions remain the weakest link across the entire model — a field-wide gap, not demographic-specific. Treat the projection as well-supported but not deterministic.`;
}

/* ------------------------------------------------------------------ */
/* Stage: Contribute                                                    */
/* ------------------------------------------------------------------ */

function Contribute({
  screen,
  twin,
  onBack,
  onSubmit,
  onSkip,
}: {
  screen: ScreenState;
  twin: TwinState;
  onBack: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const [consented, setConsented] = useState(false);
  const [deidentified, setDeidentified] = useState(true);
  const [governance, setGovernance] = useState(false);

  const canSubmit = consented && deidentified && governance;

  // Map the workspace state into the ContributePanel's draft shape.
  // ContributePanel does the actual de-identification + Firestore write.
  const initialDraft = useMemo(() => {
    const ancestryMap: Record<string, "european" | "african" | "south_asian" | "east_asian" | "hispanic_latino" | "middle_eastern" | "mixed_other" | "unknown"> = {
      european: "european",
      african: "african",
      south_asian: "south_asian",
      east_asian: "east_asian",
      hispanic: "hispanic_latino",
      middle_eastern: "middle_eastern",
      mixed: "mixed_other",
      other: "unknown",
      unknown: "unknown",
    };
    return {
      age: screen.age ? Number(screen.age) : undefined,
      sex: (screen.sex || undefined) as "female" | "male" | "other" | undefined,
      ancestry: screen.ethnicity ? ancestryMap[screen.ethnicity] ?? "unknown" : undefined,
      hla: (twin.hla || undefined) as "dq2.5" | "dq2.2" | "dq8" | "negative" | "unknown" | undefined,
      marsh: (twin.marsh || undefined) as "0" | "1" | "2" | "3a" | "3b" | "3c" | undefined,
      tTG: twin.tTG ? Number(twin.tTG) : undefined,
      ema: (twin.ema || undefined) as "positive" | "negative" | "unknown" | undefined,
      iel: twin.iel ? Number(twin.iel) : undefined,
      gfdMonths: twin.gfdMonths ? Number(twin.gfdMonths) : undefined,
      flags: Object.entries(screen.flags ?? {})
        .filter(([, on]) => on)
        .map(([k]) => k),
      notes: twin.notes || "",
    };
  }, [screen, twin]);

  return (
    <div>
      <SectionHeader
        step="Twin · Step 05"
        title="Contribute to the disease model"
        blurb="Opt-in. With patient consent, a de-identified structured profile can be added to the research pool — growing coverage for profiles like this one."
      />

      <Card>
        <CardTitle>Clinician attestations</CardTitle>
        <div className="mt-4 space-y-3">
          <Attestation
            checked={consented}
            onChange={setConsented}
            title="Patient consent obtained"
            body="The patient has consented, under my existing institutional framework, to contribute a de-identified structured profile for research use."
          />
          <Attestation
            checked={deidentified}
            onChange={setDeidentified}
            title="No identifiers included"
            body="I confirm this submission contains only structured clinical values — no names, DOB, MRN, addresses, or free-text identifiers."
          />
          <Attestation
            checked={governance}
            onChange={setGovernance}
            title="Under institutional governance"
            body="This contribution is covered by my institution's existing data-sharing and ethics governance (e.g. HIPAA, GDPR, local IRB/REC)."
          />
        </div>
        {!canSubmit && (
          <p className="mt-4 text-xs text-warm">
            Tick all three to unlock the contribution panel below.
          </p>
        )}
      </Card>

      {canSubmit && (
        <div className="mt-6">
          <ContributePanel
            initial={initialDraft}
            onSuccess={() => {
              // Auto-advance to the "done" stage ~1.5s after the toast
              // appears, so the clinician sees the confirmation chip.
              window.setTimeout(onSubmit, 1500);
            }}
          />
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full border border-line bg-cream px-5 py-3 text-sm text-warm transition hover:border-deep/30 hover:text-deep"
        >
          Skip — don&apos;t contribute
        </button>
      </div>

      <StageNav onBack={onBack} hideNext />
    </div>
  );
}

function Attestation({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
        checked
          ? "border-wheat bg-wheat-pale"
          : "border-line bg-cream hover:border-deep/30",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
          checked
            ? "border-wheat-deep bg-wheat-deep text-cream"
            : "border-line bg-cream",
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      <div>
        <div className="text-[14px] font-medium text-deep">{title}</div>
        <div className="mt-1 text-[12px] leading-relaxed text-warm">{body}</div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Stage: Done                                                          */
/* ------------------------------------------------------------------ */

function Done({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-3xl border border-line bg-cream p-10 text-center">
      <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-safe/10 text-safe ring-1 ring-safe/30">
        <Check className="h-6 w-6" />
      </div>
      <h2 className="serif text-3xl text-deep">Session complete</h2>
      <p className="mx-auto mt-3 max-w-xl text-[14px] text-warm">
        The disease model just learned a little more about patients like this
        one. Confidence scores will improve for future queries in the same
        profile space.
      </p>
      <div className="mt-7 flex justify-center">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-full bg-deep px-6 py-3 text-sm text-cream transition hover:bg-charcoal"
        >
          Start a new patient session
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared UI bits                                                       */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-xl border border-line bg-cream px-3 py-2 text-[14px] text-deep outline-none transition focus:border-wheat focus:ring-2 focus:ring-wheat/20";

function SectionHeader({
  step,
  title,
  blurb,
}: {
  step: string;
  title: string;
  blurb: string;
}) {
  return (
    <div className="mb-8 max-w-3xl">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-warm">
        {step}
      </div>
      <h1 className="serif text-3xl leading-tight text-deep sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-warm">{blurb}</p>
    </div>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-cream p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-widest text-warm">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-warm">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12px] text-warm">{label}</span>
      <span className="text-[13px] text-deep">{value}</span>
    </div>
  );
}

function Tag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-1 font-mono text-[11px] text-warm",
        className,
      )}
    >
      {children}
    </span>
  );
}

function GapStat({
  tone,
  heading,
  sub,
  detail,
}: {
  tone: "safe" | "wheat" | "alert";
  heading: string;
  sub: string;
  detail: string;
}) {
  const cls = {
    safe: "border-safe/30 bg-safe/5",
    wheat: "border-wheat/40 bg-wheat-pale",
    alert: "border-alert/30 bg-alert/5",
  }[tone];
  return (
    <div className={cn("rounded-2xl border p-5", cls)}>
      <div className="serif text-2xl text-deep">{heading}</div>
      <div className="mt-1 text-[12px] uppercase tracking-widest text-warm">
        {sub}
      </div>
      <div className="mt-3 text-[13px] text-warm">{detail}</div>
    </div>
  );
}

function StageNav({
  onBack,
  onNext,
  nextLabel,
  hideNext,
}: {
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  hideNext?: boolean;
}) {
  return (
    <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-5 py-2.5 text-sm text-warm transition hover:border-deep/30 hover:text-deep"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      {!hideNext && onNext && (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-full bg-deep px-6 py-3 text-sm text-cream transition hover:bg-charcoal"
        >
          {nextLabel ?? "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
