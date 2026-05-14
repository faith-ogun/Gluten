/**
 * Gemma 4 31B six-layer twin reasoning engine.
 *
 * Orchestration for `POST /api/gemma/twin`. Given a patient FHIR profile,
 * this:
 *   1. Scores per-layer demographic confidence (deterministic, `confidence.ts`)
 *   2. Retrieves ~4 PubMed abstracts per layer via the RAG index
 *      (`rag.ts`); adds a 3-hit equity retrieval when overall<0.5
 *   3. Composes a structured prompt with per-layer evidence blocks
 *   4. Calls Gemma 4 31B via Ollama Cloud (`gemma4:31b-cloud`) with a
 *      JSON schema that forces grounded per-layer narratives + citations
 *   5. Returns a typed projection the UI can render
 *
 * Design notes:
 * - Confidence numbers are NOT asked of the model. They come from math
 *   (`scoreConfidence`) and are fed IN as context. We only ask Gemma to
 *   write narratives. This keeps hallucination out of the numbers.
 * - Every narrative must cite at least one PMID from the layer's
 *   evidence block. Enforced by prompt; PMID set is also passed to the
 *   model explicitly so it has a closed vocabulary to cite from.
 * - Style is prose (B), 3–5 sentences per layer, aimed at shared
 *   decision-making with the patient (Ziemssen MS twin precedent).
 * - The model ID is env-configurable (`TWIN_MODEL`) so we can flip
 *   between `gemma4:31b-cloud` (demo) and a smaller local tag
 *   (development / fallback) without touching code.
 */

import { chatJson } from "./ollama";
import { scoreConfidence, type PatientProfile, type ConfidenceResult } from "./confidence";
import { LAYERS, LAYER_ORDER, type LayerId } from "./layers";
import { ragSearch, type RagHit } from "./rag";

export const TWIN_MODEL = process.env.TWIN_MODEL ?? "gemma4:31b-cloud";

const EVIDENCE_STRENGTHS = ["insufficient", "limited", "moderate", "strong"] as const;
type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

/** Input to /api/gemma/twin. Free-form clinician-gathered patient facts. */
export type TwinInputPayload = {
  age?: number;
  sex?: "female" | "male" | "other";
  ancestry?: PatientProfile["ancestry"];
  hla?: "dq2.5" | "dq2.2" | "dq8" | "negative" | "unknown";
  marsh?: "0" | "1" | "2" | "3a" | "3b" | "3c";
  tTG?: number;
  ema?: "positive" | "negative" | "unknown";
  iel?: number;
  gfdMonths?: number;
  flags?: string[];
  notes?: string;
};

/** Structured output from the model (Ollama JSON-schema enforced). */
export type TwinGeneration = {
  overall: {
    headline: string;
    marshTrajectory: string | null;
    ielTrajectory: string | null;
    tTGTrajectory: string | null;
    gfdResponse: string;
    riskFlags: string[];
  };
  layers: Record<LayerId, {
    narrative: string;
    citedPmids: string[];
    evidenceStrength: EvidenceStrength;
  }>;
  equity: {
    demographicMatch: "LOW" | "PARTIAL" | "HIGH";
    notes: string;
    citedPmids: string[];
  };
  reasoning: string;
};

export type TwinResponse = {
  generation: TwinGeneration;
  confidence: ConfidenceResult;
  evidence: {
    perLayer: Record<LayerId, RagHit[]>;
    equity: RagHit[];
  };
  model: string;
  durationMs: number;
};

/* ------------------------------ prompt ----------------------------- */

function formatRagBlock(hits: RagHit[]): string {
  if (hits.length === 0) return "(no relevant abstracts retrieved)";
  return hits
    .map((h, i) => {
      const abs = h.abstract.length > 700 ? h.abstract.slice(0, 700) + "…" : h.abstract;
      return `[${i + 1}] PMID ${h.pmid} (${h.year}) — ${h.journal}
    "${h.title}"
    ${abs}`;
    })
    .join("\n\n");
}

function formatLayerScope(id: LayerId): string {
  const s = LAYERS[id];
  const lines = [
    `• Dataset: ${s.dataset}`,
    `• n = ${s.nSamples}, sites: ${s.sitesRepresented.join("; ")}`,
    `• Age range: ${s.ageRange.min}–${s.ageRange.max}; sex: ${s.sex.join("/")}; ancestry covered: ${s.ancestryCovered.join(", ")}`,
    `• Diagnosis states: ${s.diagnosisStates.join(", ")}`,
  ];
  if (s.tissueMismatch) lines.push(`• Tissue caveat: ${s.tissueMismatch}`);
  if (s.populationLevel) lines.push(`• Scope caveat: ${s.populationLevel}`);
  lines.push(`• Notes: ${s.notes}`);
  return lines.join("\n");
}

function formatPatient(p: TwinInputPayload, conf: ConfidenceResult): string {
  const lines: string[] = [];
  if (p.age !== undefined) lines.push(`Age: ${p.age}`);
  if (p.sex) lines.push(`Sex: ${p.sex}`);
  if (p.ancestry && p.ancestry !== "unknown") lines.push(`Ancestry: ${p.ancestry}`);
  if (p.hla) lines.push(`HLA: ${p.hla.toUpperCase()}`);
  if (p.marsh) lines.push(`Marsh grade (current): ${p.marsh}`);
  if (p.tTG !== undefined) lines.push(`tTG-IgA: ${p.tTG} U/mL`);
  if (p.ema) lines.push(`EMA: ${p.ema}`);
  if (p.iel !== undefined) lines.push(`IEL count: ${p.iel} per 100 enterocytes`);
  if (p.gfdMonths !== undefined) lines.push(`Time on strict GFD: ${p.gfdMonths} months`);
  if (p.flags?.length) lines.push(`Red-flag clusters present: ${p.flags.join(", ")}`);
  if (p.notes) lines.push(`Clinician notes: ${p.notes}`);

  lines.push("");
  lines.push("Per-layer demographic confidence (computed deterministically — DO NOT re-estimate these numbers):");
  for (const id of LAYER_ORDER) {
    const d = conf.detail[id];
    const reasons = d.reasons.length ? ` — ${d.reasons.join("; ")}` : "";
    lines.push(`  • ${LAYERS[id].label}: ${d.score.toFixed(2)}${reasons}`);
  }
  lines.push(`  • Overall: ${conf.overall.toFixed(2)} (match: ${conf.match})`);

  return lines.join("\n");
}

function buildPrompt(
  patient: TwinInputPayload,
  conf: ConfidenceResult,
  perLayer: Record<LayerId, RagHit[]>,
  equity: RagHit[],
): { system: string; user: string } {
  const system = `You are the Glüten coeliac disease digital twin — a clinician-facing reasoning engine.

ROLE
You are given (a) a patient's structured clinical profile, (b) six evidence blocks — one per disease layer — each containing 3–5 PubMed abstracts retrieved for this specific patient, and (c) an optional equity block with non-European / under-represented-population evidence. You produce a personalised projection (the product) and per-layer narratives that explain which parts of the composite disease model actually support the projection for this patient (the equity finding).

AUDIENCE
Clinicians (gastroenterologists, GPs) who may review the output together with the patient during a consultation. Write so a GP can read a narrative in a few seconds and explain it to the patient in plain language.

GROUNDING RULES — NON-NEGOTIABLE
1. Every layer narrative MUST cite at least one PMID from THAT layer's evidence block. If a claim in the narrative does not correspond to a retrieved abstract, drop the claim.
2. If the layer's evidence block is empty or the abstracts are clearly off-topic for the patient's profile, write "insufficient evidence for this patient profile" and set evidenceStrength to "insufficient". Do not fabricate citations.
3. Do NOT re-estimate confidence numbers. They come from deterministic math and are given to you as context; your job is only to explain them in narrative form.
4. If the patient is from a population under-represented in the layer's cohort (visible in the patient block as low confidence), say so explicitly in that layer's narrative and frame the projection as extrapolation.

STYLE
Discursive prose — 3–5 sentences per layer narrative. Not bullet points. Clinically precise but plain enough to discuss with a patient. Do NOT repeat the confidence number inside the narrative. Do NOT hedge with generic phrases like "further research is needed" — be concrete about what is and isn't supported.

EQUITY NARRATIVE — SPECIFIC INSTRUCTIONS
The equity.notes field must be written from the PATIENT'S perspective, not the dataset's. Begin by naming the patient's ancestry (from the Patient Profile block, e.g. "This patient is African / South Asian / …") and state directly what that means for the reliability of the projection. Do NOT open with phrases like "This patient is well-represented in European cohorts" when the patient is NOT European — that inverts the finding. If the patient's ancestry is under-represented (confidence.match = LOW or PARTIAL), the first sentence should make that plain (e.g. "This projection is an extrapolation for an African patient — the underlying cohorts are overwhelmingly European.") If confidence.match = HIGH, say so plainly ("This patient's ancestry is well-covered by the underlying cohorts.") The goal is that a clinician reading the equity note immediately understands whether the projection applies to THIS patient, not a generic discussion of data gaps.

OUTPUT
A single JSON object matching the provided schema. The fields marshTrajectory / ielTrajectory / tTGTrajectory are strings like "3b → 1" / "42 → <25" / "84 → <12"; use null if the patient's input didn't include that measurement. riskFlags is a short array of concise clinical flags (e.g. "persistent iron deficiency despite GFD"). citedPmids are string arrays; they MUST be a subset of the PMIDs you were given in the relevant block.`;

  const layerBlocks = LAYER_ORDER.map((id) => {
    const hits = perLayer[id];
    const pmids = hits.map((h) => h.pmid).join(", ") || "(none)";
    return `━━ LAYER: ${LAYERS[id].label.toUpperCase()} (id: ${id}) ━━
Scope:
${formatLayerScope(id)}

Retrieved abstracts (${hits.length}):
${formatRagBlock(hits)}

PMIDs available for citation in this layer's narrative: ${pmids}`;
  }).join("\n\n");

  const equityBlock = equity.length > 0
    ? `━━ EQUITY CONTEXT (under-represented-population literature) ━━
${formatRagBlock(equity)}

PMIDs available for citation in equity.citedPmids: ${equity.map((h) => h.pmid).join(", ")}`
    : "━━ EQUITY CONTEXT ━━\n(No equity retrieval performed — patient profile is within the model's demographic coverage.)";

  const user = `PATIENT PROFILE
${formatPatient(patient, conf)}

${layerBlocks}

${equityBlock}

Produce the JSON now. The reasoning field is your internal chain-of-thought (will not be shown to the user but is useful for you to organise the reasoning step-by-step before emitting the narratives).`;

  return { system, user };
}

/* ----------------------------- schema ------------------------------ */

function makePmidEnum(pmids: string[]): Record<string, unknown> {
  // Closed citation vocabulary. Empty corpus → allow empty string so the
  // schema still validates when the model correctly cites nothing.
  return { type: "string", enum: pmids.length > 0 ? pmids : [""] };
}

function buildSchema(
  perLayer: Record<LayerId, RagHit[]>,
  equity: RagHit[],
): Record<string, unknown> {
  const layerProps: Record<string, unknown> = {};
  for (const id of LAYER_ORDER) {
    const pmids = perLayer[id].map((h) => h.pmid);
    layerProps[id] = {
      type: "object",
      properties: {
        narrative: { type: "string" },
        citedPmids: {
          type: "array",
          items: makePmidEnum(pmids),
          uniqueItems: true,
        },
        evidenceStrength: { type: "string", enum: [...EVIDENCE_STRENGTHS] },
      },
      required: ["narrative", "citedPmids", "evidenceStrength"],
    };
  }

  return {
    type: "object",
    properties: {
      overall: {
        type: "object",
        properties: {
          headline: { type: "string" },
          marshTrajectory: { type: ["string", "null"] },
          ielTrajectory: { type: ["string", "null"] },
          tTGTrajectory: { type: ["string", "null"] },
          gfdResponse: { type: "string" },
          riskFlags: { type: "array", items: { type: "string" } },
        },
        required: [
          "headline",
          "marshTrajectory",
          "ielTrajectory",
          "tTGTrajectory",
          "gfdResponse",
          "riskFlags",
        ],
      },
      layers: {
        type: "object",
        properties: layerProps,
        required: LAYER_ORDER as unknown as string[],
      },
      equity: {
        type: "object",
        properties: {
          demographicMatch: { type: "string", enum: ["LOW", "PARTIAL", "HIGH"] },
          notes: { type: "string" },
          citedPmids: {
            type: "array",
            items: makePmidEnum(equity.map((h) => h.pmid)),
            uniqueItems: true,
          },
        },
        required: ["demographicMatch", "notes", "citedPmids"],
      },
      reasoning: { type: "string" },
    },
    required: ["overall", "layers", "equity", "reasoning"],
  };
}

/* --------------------------- normalization ------------------------- */

/**
 * Ollama Cloud does not consistently enforce the `format` JSON schema
 * for the cloud-routed `:cloud` model tags — unlike local Ollama, where
 * schema enforcement is strict. `gemma4:31b-cloud` frequently emits the
 * RIGHT information under DIFFERENT key names (e.g. `projection` instead
 * of `overall`, `layerNarratives` instead of `layers`, `high`/`medium`/
 * `low` instead of `strong`/`moderate`/`limited`).
 *
 * Rather than reject good output on a naming technicality, we normalize
 * the raw generation into the canonical `TwinGeneration` shape. The
 * model's clinical content is preserved; only the envelope is fixed.
 */
function normalizeGeneration(
  raw: unknown,
  confidence: ConfidenceResult,
  perLayer: Record<LayerId, RagHit[]>,
  equityHits: RagHit[],
): TwinGeneration {
  const r = (raw ?? {}) as Record<string, unknown>;

  const overallRaw = (r.overall ?? r.projection ?? r.overall_projection ?? {}) as Record<string, unknown>;
  const layersRaw = (r.layers ?? r.layerNarratives ?? r.perLayer ?? {}) as Record<string, unknown>;
  const equityRaw = (r.equity ?? r.equityFinding ?? r.equity_note ?? {}) as Record<string, unknown>;

  const strengthMap: Record<string, EvidenceStrength> = {
    strong: "strong", high: "strong",
    moderate: "moderate", medium: "moderate", mid: "moderate",
    limited: "limited", low: "limited",
    insufficient: "insufficient", none: "insufficient",
  };
  function normStrength(v: unknown): EvidenceStrength {
    if (typeof v !== "string") return "insufficient";
    return strengthMap[v.toLowerCase()] ?? "insufficient";
  }

  function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return null;
  }
  function pickStringArray(obj: Record<string, unknown>, keys: string[]): string[] {
    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
    }
    return [];
  }

  const headline = pickString(overallRaw, ["headline", "summary", "title"])
    ?? pickString(r, ["headline", "summary"])
    ?? "Personalised six-layer coeliac disease projection";

  const layers = {} as TwinGeneration["layers"];
  for (const id of LAYER_ORDER) {
    const lRaw = (layersRaw[id] ?? {}) as Record<string, unknown>;
    layers[id] = {
      narrative: pickString(lRaw, ["narrative", "text", "summary"])
        ?? "(model returned no narrative for this layer)",
      citedPmids: pickStringArray(lRaw, ["citedPmids", "cited_pmids", "pmids", "citations"])
        .filter((p) => perLayer[id].some((h) => h.pmid === p)),
      evidenceStrength: normStrength(lRaw.evidenceStrength ?? lRaw.strength ?? lRaw.confidence),
    };
  }

  const matchRaw = pickString(equityRaw, ["demographicMatch", "match", "demographic_match"]);
  const matchNorm = matchRaw?.toUpperCase();
  const demographicMatch: "LOW" | "PARTIAL" | "HIGH" =
    matchNorm === "LOW" || matchNorm === "PARTIAL" || matchNorm === "HIGH"
      ? matchNorm
      : confidence.match;

  const allowedEquityPmids = new Set(equityHits.map((h) => h.pmid));

  return {
    overall: {
      headline,
      marshTrajectory: pickString(overallRaw, ["marshTrajectory", "marsh_trajectory", "marsh"]),
      ielTrajectory: pickString(overallRaw, ["ielTrajectory", "iel_trajectory", "iel"]),
      tTGTrajectory: pickString(overallRaw, ["tTGTrajectory", "ttg_trajectory", "tTG", "ttg"]),
      gfdResponse: pickString(overallRaw, ["gfdResponse", "gfd_response", "gfd", "response"])
        ?? pickString(r, ["gfdResponse", "gfd_response"])
        ?? "",
      riskFlags: pickStringArray(overallRaw, ["riskFlags", "risk_flags", "flags", "risks"]),
    },
    layers,
    equity: {
      demographicMatch,
      notes: pickString(equityRaw, ["notes", "narrative", "text"]) ?? "",
      citedPmids: pickStringArray(equityRaw, ["citedPmids", "cited_pmids", "pmids", "citations"])
        .filter((p) => allowedEquityPmids.has(p)),
    },
    reasoning: pickString(r, ["reasoning", "thought", "thoughts"]) ?? "",
  };
}

/* ------------------------------ core ------------------------------- */

function buildLayerQuery(p: TwinInputPayload, id: LayerId): string {
  // Per-layer seed queries: narrow enough to surface layer-relevant
  // abstracts, broad enough not to zero-hit for partial patient profiles.
  const demo = [
    p.age ? `age ${p.age}` : "",
    p.sex ?? "",
    p.ancestry && p.ancestry !== "unknown" ? p.ancestry : "",
  ].filter(Boolean).join(" ");
  const marsh = p.marsh ? `Marsh ${p.marsh}` : "";
  const gfd = p.gfdMonths !== undefined
    ? p.gfdMonths > 0 ? `${p.gfdMonths} months gluten-free diet` : "newly diagnosed pre-GFD"
    : "";
  const serology = p.tTG !== undefined ? `tTG-IgA ${p.tTG}` : "";
  const hla = p.hla && p.hla !== "unknown" && p.hla !== "negative" ? `HLA-${p.hla.toUpperCase()}` : "";

  switch (id) {
    case "clinical":
      return `coeliac disease diagnosis serology ${serology} ${marsh} ${gfd} ${demo}`.trim();
    case "molecular":
      return `coeliac disease duodenal transcriptome immune checkpoint gene expression ${marsh} ${demo}`.trim();
    case "structural":
      return `coeliac disease duodenal biopsy histopathology villous atrophy IEL ${marsh} ${demo}`.trim();
    case "microbiome":
      return `coeliac disease gut microbiome metaproteome gluten-free diet ${gfd} ${demo}`.trim();
    case "longitudinal":
      return `coeliac disease T cell receptor HLA-DQ2 gluten-reactive tetramer ${hla} ${demo}`.trim();
    case "genomic":
      return `coeliac disease polygenic risk HLA-DQ2 DQ8 GWAS SNP ${hla} ${demo}`.trim();
  }
}

function buildEquityQuery(p: TwinInputPayload): string {
  const anc = p.ancestry && p.ancestry !== "unknown" ? p.ancestry : "underserved population";
  return `coeliac disease ${anc} diagnostic delay false negative serology underdiagnosis`;
}

export async function runTwinEngine(
  input: TwinInputPayload,
): Promise<TwinResponse> {
  const t0 = Date.now();

  const profile: PatientProfile = {
    age: input.age,
    sex: input.sex,
    ancestry: input.ancestry,
    diagnosisState: input.gfdMonths !== undefined && input.gfdMonths > 0
      ? "on-gfd"
      : "pre-diagnosis",
  };
  const confidence = scoreConfidence(profile);

  // Retrieve per-layer in parallel (7 searches total with equity)
  const [layerHitsArr, equityHits] = await Promise.all([
    Promise.all(
      LAYER_ORDER.map(async (id) => {
        const hits = await ragSearch(buildLayerQuery(input, id), { k: 4, slice: id });
        return [id, hits] as const;
      }),
    ),
    confidence.overall < 0.5
      ? ragSearch(buildEquityQuery(input), { k: 3, slice: "equity" })
      : Promise.resolve([] as RagHit[]),
  ]);
  const perLayer = Object.fromEntries(layerHitsArr) as Record<LayerId, RagHit[]>;

  const { system, user } = buildPrompt(input, confidence, perLayer, equityHits);
  const schema = buildSchema(perLayer, equityHits);

  const raw = await chatJson<unknown>({
    model: TWIN_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    schema,
    options: {
      temperature: 0.2,
      // Deliberately generous — Gemma's thinking channel shares this
      // budget with output content, and the six-layer narrative + equity
      // block will run 1500–2500 content tokens on top of whatever the
      // model burns on internal reasoning. 6000 leaves headroom.
      num_predict: 6000,
    },
  });

  // Normalize key-naming drift from Ollama Cloud (see normalizeGeneration).
  const generation = normalizeGeneration(raw, confidence, perLayer, equityHits);

  return {
    generation,
    confidence,
    evidence: { perLayer, equity: equityHits },
    model: TWIN_MODEL,
    durationMs: Date.now() - t0,
  };
}
