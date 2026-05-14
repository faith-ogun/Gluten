"use client";

/**
 * One-click demo prefill bar for the judges / video demo.
 *
 * Lives above the wizard input forms. Each persona is a realistic
 * composite profile designed to showcase a distinct capability of the
 * twin:
 *   - `screen-equity`   — 28y African F, non-specific symptoms that
 *     trigger the tTG-IgA false-negative advisory.
 *   - `screen-classic`  — 42y white-European M with textbook CD signs.
 *   - `twin-cinematic`  — 28y African F newly diagnosed, partial data,
 *     drops microbiome + longitudinal confidence sharply. This is the
 *     "cinematic moment" in CLAUDE.md §12 (video script).
 *   - `twin-followup`   — 34y white-European F, 6 months on strict GFD,
 *     high confidence across all layers — good "control" contrast.
 *
 * Keeps the existing example text in the Dictate panels intact — the
 * Dictate examples exist to show OFF the Gemma 4 E4B extraction; the
 * prefills here exist to SKIP data entry entirely so a judge can click
 * through the whole flow in under 30 seconds.
 */

import { Zap } from "lucide-react";
import type { ScreenState, TwinState } from "@/lib/forms";

export type ScreenPersona = {
  id: string;
  label: string;
  sub: string;
  screen: ScreenState;
};

export type TwinPersona = {
  id: string;
  label: string;
  sub: string;
  twin: TwinState;
  /** Demographics paired with the twin values. When a clinician enters
   *  via twin mode directly (no screening), we still want ancestry / age /
   *  sex to reach the confidence scorer and the Gemma engine — they
   *  live in screen state because both entry points share the same
   *  demographics fields.
   */
  demo: Partial<ScreenState>;
};

export const SCREEN_PERSONAS: ScreenPersona[] = [
  {
    id: "screen-equity",
    label: "28y African F · iron-def + IBS",
    sub: "Triggers bias-aware test advisory",
    screen: {
      age: "28",
      sex: "female",
      ethnicity: "african",
      flags: {
        "iron-deficiency": true,
        "fatigue": true,
        "ibs": true,
        "family-hx": true,
      },
    },
  },
  {
    id: "screen-classic",
    label: "42y white-European M · textbook",
    sub: "High-probability coeliac pattern",
    screen: {
      age: "42",
      sex: "male",
      ethnicity: "white-european",
      flags: {
        "iron-deficiency": true,
        "b12-folate": true,
        "weight-loss": true,
        "bloating": true,
        "osteoporosis": true,
      },
    },
  },
];

export const TWIN_PERSONAS: TwinPersona[] = [
  {
    id: "twin-cinematic",
    label: "28y African F · newly diagnosed",
    sub: "Partial data · confidence drops on microbiome + longitudinal",
    demo: { age: "28", sex: "female", ethnicity: "african" },
    twin: {
      tTG: "84",
      ema: "positive",
      hla: "dq2.5",
      marsh: "3b",
      iel: "42",
      gfdMonths: "0",
      notes: "T1DM since age 12. Mother has Hashimoto's thyroiditis.",
    },
  },
  {
    id: "twin-followup",
    label: "34y white-European F · 6mo on GFD",
    sub: "High confidence across all layers",
    demo: { age: "34", sex: "female", ethnicity: "white-european" },
    twin: {
      tTG: "12",
      ema: "negative",
      hla: "dq2.5",
      marsh: "1",
      iel: "18",
      gfdMonths: "6",
      notes: "Strict GFD adherence. Symptoms resolved at 3 months.",
    },
  },
];

export function ScreenPrefillBar({
  onApply,
}: {
  onApply: (s: ScreenState) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-wheat-deep/50 bg-wheat-pale/30 p-3">
      <div className="flex items-center gap-1.5 pr-1 font-mono text-[10.5px] uppercase tracking-widest text-wheat-deep">
        <Zap className="h-3 w-3" />
        Demo pre-fill
      </div>
      {SCREEN_PERSONAS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onApply(p.screen)}
          title={p.sub}
          className="group inline-flex flex-col items-start gap-0.5 rounded-lg border border-wheat/50 bg-cream px-3 py-1.5 text-left text-[11.5px] text-deep transition hover:border-deep hover:bg-wheat-pale/60"
        >
          <span className="font-medium">{p.label}</span>
          <span className="text-[10.5px] text-warm group-hover:text-deep/80">
            {p.sub}
          </span>
        </button>
      ))}
      <span className="ml-auto font-mono text-[10px] text-warm/70">
        one-click fill · for judges & demo
      </span>
    </div>
  );
}

export function TwinPrefillBar({
  onApply,
}: {
  onApply: (t: TwinState, demo: Partial<ScreenState>) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-wheat-deep/50 bg-wheat-pale/30 p-3">
      <div className="flex items-center gap-1.5 pr-1 font-mono text-[10.5px] uppercase tracking-widest text-wheat-deep">
        <Zap className="h-3 w-3" />
        Demo pre-fill
      </div>
      {TWIN_PERSONAS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onApply(p.twin, p.demo)}
          title={p.sub}
          className="group inline-flex flex-col items-start gap-0.5 rounded-lg border border-wheat/50 bg-cream px-3 py-1.5 text-left text-[11.5px] text-deep transition hover:border-deep hover:bg-wheat-pale/60"
        >
          <span className="font-medium">{p.label}</span>
          <span className="text-[10.5px] text-warm group-hover:text-deep/80">
            {p.sub}
          </span>
        </button>
      ))}
      <span className="ml-auto font-mono text-[10px] text-warm/70">
        one-click fill · for judges & demo
      </span>
    </div>
  );
}
