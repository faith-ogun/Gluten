/**
 * De-identification engine for clinician contributions.
 *
 * Glüten contributions never leave the clinician's institutional governance:
 * the clinician handles patient consent. But what crosses the network into
 * the global research pool must be free of HIPAA Safe Harbor identifiers
 * and GDPR-recognised direct identifiers, by construction.
 *
 * This module does two things:
 *   1. `deidentify(input)` — pure function. Takes the clinician's draft
 *      contribution, returns the scrubbed payload PLUS a diff describing
 *      exactly what was changed. The diff is what the UI animates.
 *   2. `assertNoPHI(value)` — defence-in-depth scanner that walks the
 *      output and throws if any HIPAA-flagged pattern survived (names,
 *      emails, phone numbers, exact dates, MRN-shaped strings, etc.).
 *      Run on the server before write.
 *
 * No I/O. No Firestore. Pure functions, fully unit-testable.
 *
 * Reference: 45 CFR 164.514(b)(2) — HIPAA Safe Harbor list of 18 PHI
 * identifiers. We implement the subset that can plausibly appear in
 * Glüten's structured payload + a free-text scanner for anything that
 * slips through a clinician's notes field.
 */

export type ContributionDraft = {
  // Demographics — exact values that need bucketing.
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

  // Clinical — already structured.
  hla?: "dq2.5" | "dq2.2" | "dq8" | "negative" | "unknown";
  marsh?: "0" | "1" | "2" | "3a" | "3b" | "3c";
  tTG?: number; // U/mL, exact
  ema?: "positive" | "negative" | "unknown";
  iel?: number; // per 100 enterocytes, exact
  gfdMonths?: number; // months since GFD start

  // Optional free-text from the clinician. Always dropped; never written.
  notes?: string;

  // Optional clinician-supplied flags (controlled vocabulary).
  flags?: string[];
};

export type DeidentifiedContribution = {
  // Demographics — bucketed.
  ageBucket?: AgeBucket;
  sex?: ContributionDraft["sex"];
  ancestry?: ContributionDraft["ancestry"];

  // Clinical — structured, with sensitive numeric fields binned.
  hla?: ContributionDraft["hla"];
  marsh?: ContributionDraft["marsh"];
  tTG_bin?: tTGBin;
  ema?: ContributionDraft["ema"];
  iel_bin?: IELBin;
  gfdMonths_bin?: GFDBin;

  // Controlled-vocab flags only.
  flags: string[];

  // Provenance metadata.
  schemaVersion: "v1";
  contributedAtYear: number; // year only, no day/month
};

export type AgeBucket =
  | "0-9"
  | "10-19"
  | "20-29"
  | "30-39"
  | "40-49"
  | "50-59"
  | "60-69"
  | "70-79"
  | "80+";

export type tTGBin = "<20" | "20-50" | "50-100" | ">100";
export type IELBin = "<25" | "25-40" | ">40";
export type GFDBin = "0" | "1-3" | "4-6" | "7-12" | "13-24" | ">24";

/**
 * One row of the human-readable change report. The UI iterates this list
 * and animates each strike-through / replacement.
 */
export type ScrubDiff = {
  field: string;
  before: string;
  after: string;
  reason:
    | "exact_value_bucketed"
    | "free_text_dropped"
    | "unknown_flag_dropped"
    | "identifier_redacted"
    | "field_not_collected";
};

/* ------------------------------------------------------------------ */
/* Allow-list of clinical flag codes. Anything else is dropped.       */
/* ------------------------------------------------------------------ */

const ALLOWED_FLAGS = new Set<string>([
  "dh", // dermatitis herpetiformis
  "t1d", // type 1 diabetes
  "thyroid", // autoimmune thyroid
  "iron_deficiency",
  "b12_deficiency",
  "osteoporosis",
  "infertility",
  "elevated_lfts",
  "family_history_ad", // family history of autoimmune disease
  "neuropathy",
]);

/* ------------------------------------------------------------------ */
/* PHI regexes. Belt-and-braces, run over any leftover free text.     */
/* ------------------------------------------------------------------ */

// Note: no `g` flag on these. `RegExp.test()` with `g` is stateful
// (advances `lastIndex` per call) and breaks when the same regex is
// re-used across many fields in `assertNoPHI`.
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;
const DATE_RE =
  /\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\b/;
const MRN_RE = /\b(?:MRN|mrn|medical[\s-]?record[\s-]?(?:number|no))[:\s#]*\w{4,}\b/;
const URL_RE = /\bhttps?:\/\/\S+/i;
// Heuristic: probable proper-noun pair after a salutation.
const NAME_RE =
  /\b(?:Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/;

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function bucketAge(age: number | undefined): AgeBucket | undefined {
  if (age === undefined || !Number.isFinite(age) || age < 0) return undefined;
  if (age >= 80) return "80+";
  const decade = Math.floor(age / 10);
  return `${decade * 10}-${decade * 10 + 9}` as AgeBucket;
}

export function bucketTTG(tTG: number | undefined): tTGBin | undefined {
  if (tTG === undefined || !Number.isFinite(tTG) || tTG < 0) return undefined;
  if (tTG < 20) return "<20";
  if (tTG < 50) return "20-50";
  if (tTG < 100) return "50-100";
  return ">100";
}

export function bucketIEL(iel: number | undefined): IELBin | undefined {
  if (iel === undefined || !Number.isFinite(iel) || iel < 0) return undefined;
  if (iel < 25) return "<25";
  if (iel <= 40) return "25-40";
  return ">40";
}

export function bucketGFD(months: number | undefined): GFDBin | undefined {
  if (months === undefined || !Number.isFinite(months) || months < 0)
    return undefined;
  if (months === 0) return "0";
  if (months <= 3) return "1-3";
  if (months <= 6) return "4-6";
  if (months <= 12) return "7-12";
  if (months <= 24) return "13-24";
  return ">24";
}

/**
 * Returns the de-identified payload and a per-field diff describing
 * what was scrubbed. The diff is what the UI animates.
 */
export function deidentify(input: ContributionDraft): {
  output: DeidentifiedContribution;
  diff: ScrubDiff[];
} {
  const diff: ScrubDiff[] = [];

  const ageBucket = bucketAge(input.age);
  if (input.age !== undefined && ageBucket) {
    diff.push({
      field: "age",
      before: String(input.age),
      after: ageBucket,
      reason: "exact_value_bucketed",
    });
  }

  const tTG_bin = bucketTTG(input.tTG);
  if (input.tTG !== undefined && tTG_bin) {
    diff.push({
      field: "tTG-IgA",
      before: `${input.tTG} U/mL`,
      after: tTG_bin,
      reason: "exact_value_bucketed",
    });
  }

  const iel_bin = bucketIEL(input.iel);
  if (input.iel !== undefined && iel_bin) {
    diff.push({
      field: "IEL count",
      before: `${input.iel} / 100 enterocytes`,
      after: iel_bin,
      reason: "exact_value_bucketed",
    });
  }

  const gfdMonths_bin = bucketGFD(input.gfdMonths);
  if (input.gfdMonths !== undefined && gfdMonths_bin) {
    diff.push({
      field: "Months on GFD",
      before: `${input.gfdMonths} months`,
      after: gfdMonths_bin,
      reason: "exact_value_bucketed",
    });
  }

  // Notes — always dropped. Even if the clinician typed nothing PHI-like,
  // we don't want unstructured text in the research pool.
  if (input.notes !== undefined && input.notes.trim().length > 0) {
    diff.push({
      field: "Clinician notes",
      before: previewSnippet(input.notes),
      after: "(dropped)",
      reason: "free_text_dropped",
    });
  }

  // Flags — drop anything not in the allow-list.
  const flags: string[] = [];
  for (const raw of input.flags ?? []) {
    const norm = raw.trim().toLowerCase();
    if (ALLOWED_FLAGS.has(norm)) {
      flags.push(norm);
    } else if (norm.length > 0) {
      diff.push({
        field: `Flag "${raw}"`,
        before: raw,
        after: "(dropped)",
        reason: "unknown_flag_dropped",
      });
    }
  }

  const output: DeidentifiedContribution = {
    ageBucket,
    sex: input.sex,
    ancestry: input.ancestry,
    hla: input.hla,
    marsh: input.marsh,
    tTG_bin,
    ema: input.ema,
    iel_bin,
    gfdMonths_bin,
    flags,
    schemaVersion: "v1",
    contributedAtYear: new Date().getUTCFullYear(),
  };

  return { output, diff };
}

/**
 * Defence-in-depth: walks any object and throws if it finds something
 * that matches a HIPAA-flagged regex. Run server-side BEFORE writing
 * to Firestore. If this throws, something upstream is broken.
 */
export class PHIDetectedError extends Error {
  constructor(public field: string, public pattern: string) {
    super(`PHI pattern "${pattern}" detected in field "${field}"`);
    this.name = "PHIDetectedError";
  }
}

export function assertNoPHI(value: unknown, pathPrefix = "$"): void {
  if (value === null || value === undefined) return;
  if (typeof value === "number" || typeof value === "boolean") return;

  if (typeof value === "string") {
    if (EMAIL_RE.test(value)) throw new PHIDetectedError(pathPrefix, "email");
    if (PHONE_RE.test(value)) throw new PHIDetectedError(pathPrefix, "phone");
    if (DATE_RE.test(value)) throw new PHIDetectedError(pathPrefix, "date");
    if (MRN_RE.test(value)) throw new PHIDetectedError(pathPrefix, "mrn");
    if (URL_RE.test(value)) throw new PHIDetectedError(pathPrefix, "url");
    if (NAME_RE.test(value))
      throw new PHIDetectedError(pathPrefix, "salutation_name");
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoPHI(v, `${pathPrefix}[${i}]`));
    return;
  }

  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertNoPHI(v, `${pathPrefix}.${k}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function previewSnippet(s: string): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 57) + "...";
}
