/**
 * Shared types + JSON schemas for the /app wizard forms.
 *
 * The same shapes are consumed by:
 *   - the React form state in `src/app/app/page.tsx`
 *   - the Gemma 4 E4B extractor in `src/app/api/gemma/extract/route.ts`,
 *     which uses these schemas as Ollama `format` parameters to force
 *     the model to emit a structured object matching the form state.
 *
 * Ethnicity / sex / HLA / Marsh unions are kept verbatim with the UI so
 * the extractor output can drop straight into `setScreen` / `setTwin`.
 */

export type Ethnicity =
  | ""
  | "african"
  | "black-caribbean"
  | "south-asian"
  | "east-asian"
  | "middle-eastern"
  | "hispanic-latino"
  | "white-european"
  | "mixed"
  | "other";

export const ETHNICITY_VALUES: Ethnicity[] = [
  "",
  "african",
  "black-caribbean",
  "south-asian",
  "east-asian",
  "middle-eastern",
  "hispanic-latino",
  "white-european",
  "mixed",
  "other",
];

export type Sex = "" | "female" | "male" | "other";
export const SEX_VALUES: Sex[] = ["", "female", "male", "other"];

export const ETHNICITY_LABELS: Record<Ethnicity, string> = {
  "": "Not specified",
  african: "African",
  "black-caribbean": "Black Caribbean",
  "south-asian": "South Asian",
  "east-asian": "East Asian",
  "middle-eastern": "Middle Eastern",
  "hispanic-latino": "Hispanic / Latino",
  "white-european": "White European",
  mixed: "Mixed / multiple",
  other: "Other",
};

export type RedFlagId =
  | "iron-deficiency"
  | "b12-folate"
  | "ibs"
  | "osteoporosis"
  | "fatigue"
  | "dh"
  | "family-hx"
  | "infertility"
  | "lfts"
  | "t1dm-thyroid"
  | "weight-loss"
  | "bloating";

export const RED_FLAGS: { id: RedFlagId; label: string; hint?: string }[] = [
  { id: "iron-deficiency", label: "Chronic iron deficiency anaemia", hint: "unresponsive to supplementation" },
  { id: "b12-folate", label: "Unexplained B12 or folate deficiency" },
  { id: "ibs", label: "IBS diagnosis or chronic GI symptoms" },
  { id: "osteoporosis", label: "Early-onset osteoporosis / low bone density" },
  { id: "fatigue", label: "Unexplained fatigue (persistent, >6 months)" },
  { id: "dh", label: "Dermatitis herpetiformis" },
  { id: "family-hx", label: "Family history of autoimmune disease" },
  { id: "infertility", label: "Unexplained infertility or recurrent miscarriage" },
  { id: "lfts", label: "Unexplained elevated liver enzymes" },
  { id: "t1dm-thyroid", label: "Type 1 diabetes or autoimmune thyroid disease" },
  { id: "weight-loss", label: "Unintentional weight loss" },
  { id: "bloating", label: "Chronic bloating, diarrhoea, or steatorrhoea" },
];

export const RED_FLAG_IDS = RED_FLAGS.map((f) => f.id) as RedFlagId[];

export interface ScreenState {
  age: string;
  sex: Sex;
  ethnicity: Ethnicity;
  flags: Record<string, boolean>;
}

export interface TwinState {
  tTG: string;
  ema: "" | "positive" | "negative" | "unknown";
  hla: "" | "dq2.5" | "dq2.2" | "dq8" | "negative" | "unknown";
  marsh: "" | "0" | "1" | "2" | "3a" | "3b" | "3c";
  iel: string;
  gfdMonths: string;
  notes: string;
}

/* ----------- JSON schemas for Ollama structured outputs ----------- */

const ETHNICITIES_NONEMPTY = ETHNICITY_VALUES.filter((v) => v !== "");
const SEX_NONEMPTY = SEX_VALUES.filter((v) => v !== "");

export const SCREEN_SCHEMA = {
  type: "object",
  properties: {
    age: { type: ["integer", "null"], minimum: 0, maximum: 120 },
    sex: { type: ["string", "null"], enum: [...SEX_NONEMPTY, null] },
    ethnicity: { type: ["string", "null"], enum: [...ETHNICITIES_NONEMPTY, null] },
    flags: {
      type: "array",
      items: { type: "string", enum: RED_FLAG_IDS },
      uniqueItems: true,
    },
    reasoning: { type: "string" },
  },
  required: ["age", "sex", "ethnicity", "flags", "reasoning"],
} as const;

export type ScreenExtraction = {
  age: number | null;
  sex: Exclude<Sex, ""> | null;
  ethnicity: Exclude<Ethnicity, ""> | null;
  flags: RedFlagId[];
  reasoning: string;
};

export const TWIN_SCHEMA = {
  type: "object",
  properties: {
    tTG: { type: ["number", "null"], minimum: 0 },
    ema: { type: ["string", "null"], enum: ["positive", "negative", "unknown", null] },
    hla: {
      type: ["string", "null"],
      enum: ["dq2.5", "dq2.2", "dq8", "negative", "unknown", null],
    },
    marsh: {
      type: ["string", "null"],
      enum: ["0", "1", "2", "3a", "3b", "3c", null],
    },
    iel: { type: ["number", "null"], minimum: 0 },
    gfdMonths: { type: ["number", "null"], minimum: 0 },
    notes: { type: "string" },
    reasoning: { type: "string" },
  },
  required: ["tTG", "ema", "hla", "marsh", "iel", "gfdMonths", "notes", "reasoning"],
} as const;

export type TwinExtraction = {
  tTG: number | null;
  ema: "positive" | "negative" | "unknown" | null;
  hla: "dq2.5" | "dq2.2" | "dq8" | "negative" | "unknown" | null;
  marsh: "0" | "1" | "2" | "3a" | "3b" | "3c" | null;
  iel: number | null;
  gfdMonths: number | null;
  notes: string;
  reasoning: string;
};

/** Convert a ScreenExtraction into a partial update for the wizard's setScreen. */
export function toScreenPatch(x: ScreenExtraction): Partial<ScreenState> {
  const flags: Record<string, boolean> = {};
  for (const id of x.flags) flags[id] = true;
  const patch: Partial<ScreenState> = { flags };
  if (x.age !== null) patch.age = String(x.age);
  if (x.sex !== null) patch.sex = x.sex;
  if (x.ethnicity !== null) patch.ethnicity = x.ethnicity;
  return patch;
}

/** Convert a TwinExtraction into a partial update for the wizard's setTwin. */
export function toTwinPatch(x: TwinExtraction): Partial<TwinState> {
  const patch: Partial<TwinState> = { notes: x.notes };
  if (x.tTG !== null) patch.tTG = String(x.tTG);
  if (x.ema !== null) patch.ema = x.ema;
  if (x.hla !== null) patch.hla = x.hla;
  if (x.marsh !== null) patch.marsh = x.marsh;
  if (x.iel !== null) patch.iel = String(x.iel);
  if (x.gfdMonths !== null) patch.gfdMonths = String(x.gfdMonths);
  return patch;
}
