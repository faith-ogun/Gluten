/**
 * Per-layer confidence scorer for the CD disease twin.
 *
 * Replaces the three-bucket `confidenceProfile(ethnicity)` placeholder
 * with a data-driven score that uses each layer's documented demographic
 * scope (see `layers.ts`) and combines four axes per layer:
 *   1. age       — is the patient's age inside the layer's age range?
 *   2. sex       — does the layer include the patient's sex?
 *   3. ancestry  — does the layer include the patient's ancestry?
 *   4. diagnosis — pre-diagnosis vs on-GFD vs mixed.
 *
 * Axis matches are weighted-averaged, then capped by structural
 * penalties (tissue mismatch; reference-repertoire-only layers). The
 * result is a 0..1 score per layer plus an aggregate `overall` and the
 * categorical `match` bucket the UI already consumes.
 *
 * Return shape is backwards-compatible with the original
 * `confidenceProfile(ethnicity)` function in web/src/app/app/page.tsx;
 * callers that only need `{ match, overall, layers }` do not need to
 * change. The extra `reasons` block is opt-in for the Evidence Gap view.
 */

import {
  LAYERS,
  LAYER_ORDER,
  type LayerId,
  type LayerScope,
  type AncestryBucket,
  type SexBucket,
  type DiagnosisState,
} from "./layers";

export type PatientProfile = {
  age?: number;
  sex?: SexBucket;
  ancestry?: AncestryBucket;
  diagnosisState?: DiagnosisState;
};

export type LayerConfidence = {
  score: number;
  axes: {
    age: number;
    sex: number;
    ancestry: number;
    diagnosis: number;
  };
  structuralCap: number;
  reasons: string[];
};

export type ConfidenceResult = {
  match: "HIGH" | "PARTIAL" | "LOW";
  overall: number;
  layers: Record<LayerId, number>;
  detail: Record<LayerId, LayerConfidence>;
};

const UNKNOWN_AXIS_SCORE = 0.35;

const AXIS_WEIGHTS = {
  age: 0.25,
  sex: 0.15,
  ancestry: 0.4,
  diagnosis: 0.2,
} as const;

function scoreAge(
  scope: LayerScope,
  age: number | undefined,
): { v: number; reason?: string } {
  if (age === undefined || Number.isNaN(age)) {
    return { v: UNKNOWN_AXIS_SCORE };
  }
  const { min, max } = scope.ageRange;
  if (age >= min && age <= max) return { v: 1 };
  const dist = age < min ? min - age : age - max;
  if (dist <= 5) {
    return {
      v: 0.5,
      reason: `patient age ${age} is just outside ${scope.label}'s cohort range (${min}–${max})`,
    };
  }
  return {
    v: 0.1,
    reason: `${scope.label} cohort is ages ${min}–${max}; patient is ${age}`,
  };
}

function scoreSex(
  scope: LayerScope,
  sex: SexBucket | undefined,
): { v: number; reason?: string } {
  if (!sex || sex === "unknown") return { v: UNKNOWN_AXIS_SCORE };
  if (scope.sex.includes(sex) || scope.sex.includes("unknown")) return { v: 1 };
  return {
    v: 0.05,
    reason: `${scope.label} cohort is ${scope.sex.join(" + ")} only; patient is ${sex}`,
  };
}

function scoreAncestry(
  scope: LayerScope,
  ancestry: AncestryBucket | undefined,
): { v: number; reason?: string } {
  if (!ancestry || ancestry === "unknown") return { v: UNKNOWN_AXIS_SCORE };
  if (scope.ancestryCovered.includes("unknown")) {
    return {
      v: 0.5,
      reason: `${scope.label} dataset does not record ancestry — cannot confirm match`,
    };
  }
  if (scope.ancestryCovered.includes(ancestry)) return { v: 1 };
  if (ancestry === "mixed") {
    return {
      v: 0.4,
      reason: `${scope.label} represents ${scope.ancestryCovered.join(", ")}; patient is mixed ancestry`,
    };
  }
  return {
    v: 0.08,
    reason: `${scope.label} cohort is ${scope.ancestryCovered.join(", ")}; near-zero representation for ${ancestry}`,
  };
}

function scoreDiagnosis(
  scope: LayerScope,
  state: DiagnosisState | undefined,
): { v: number; reason?: string } {
  if (!state) return { v: UNKNOWN_AXIS_SCORE };
  if (scope.diagnosisStates.includes("mixed")) return { v: 1 };
  if (scope.diagnosisStates.includes(state)) return { v: 1 };
  const labels: Record<DiagnosisState, string> = {
    "pre-diagnosis": "pre-diagnosis",
    "on-gfd": "diagnosed & on GFD",
    mixed: "mixed",
  };
  return {
    v: 0.1,
    reason: `${scope.label} covers ${scope.diagnosisStates.map((s) => labels[s]).join(", ")}; patient is ${labels[state]}`,
  };
}

function structuralCap(scope: LayerScope): { cap: number; reasons: string[] } {
  const reasons: string[] = [];
  let cap = 1;
  if (scope.tissueMismatch) {
    cap *= 0.7;
    reasons.push(scope.tissueMismatch);
  }
  if (scope.populationLevel) {
    cap *= 0.8;
    reasons.push(scope.populationLevel);
  }
  return { cap, reasons };
}

function scoreLayer(
  scope: LayerScope,
  patient: PatientProfile,
): LayerConfidence {
  const age = scoreAge(scope, patient.age);
  const sex = scoreSex(scope, patient.sex);
  const ancestry = scoreAncestry(scope, patient.ancestry);
  const diagnosis = scoreDiagnosis(scope, patient.diagnosisState);

  const demo =
    age.v * AXIS_WEIGHTS.age +
    sex.v * AXIS_WEIGHTS.sex +
    ancestry.v * AXIS_WEIGHTS.ancestry +
    diagnosis.v * AXIS_WEIGHTS.diagnosis;

  const { cap, reasons: structuralReasons } = structuralCap(scope);
  const score = Math.max(0.02, Math.min(1, demo * cap));

  const reasons: string[] = [
    ...[age.reason, sex.reason, ancestry.reason, diagnosis.reason].filter(
      (r): r is string => Boolean(r),
    ),
    ...structuralReasons,
  ];

  return {
    score,
    axes: {
      age: age.v,
      sex: sex.v,
      ancestry: ancestry.v,
      diagnosis: diagnosis.v,
    },
    structuralCap: cap,
    reasons,
  };
}

function bucketFromOverall(x: number): ConfidenceResult["match"] {
  if (x >= 0.7) return "HIGH";
  if (x >= 0.45) return "PARTIAL";
  return "LOW";
}

export function scoreConfidence(patient: PatientProfile): ConfidenceResult {
  const layers = {} as Record<LayerId, number>;
  const detail = {} as Record<LayerId, LayerConfidence>;

  for (const id of LAYER_ORDER) {
    const c = scoreLayer(LAYERS[id], patient);
    layers[id] = c.score;
    detail[id] = c;
  }

  const overall =
    LAYER_ORDER.reduce((s, id) => s + layers[id], 0) / LAYER_ORDER.length;

  return {
    match: bucketFromOverall(overall),
    overall,
    layers,
    detail,
  };
}
