/**
 * Per-layer demographic + structural scope for the six-layer CD disease twin.
 *
 * Each entry distils the `data/<layer>/DATA_DICTIONARY.md` we wrote during
 * ingest into structured metadata the confidence scorer consumes. When the
 * underlying dataset changes, this is the one file to update.
 *
 * Axes:
 *   age              — inclusive integer range
 *   sex              — which sexes are represented
 *   ancestry         — ISO-ish buckets matching the /app Ethnicity union
 *   diagnosisStates  — pre-diagnosis / diagnosed-on-GFD / mixed
 *
 * Structural flags capture hard scope facts that aren't demographics:
 *   tissueMismatch   — e.g. Structural is colon, not duodenum
 *   populationLevel  — layer is aggregate/reference, not per-patient
 *
 * All numbers here are sourced from the `data/<layer>/DATA_DICTIONARY.md`
 * files committed 2026-04-19. Keep in sync with those dictionaries.
 */

export type LayerId =
  | "clinical"
  | "molecular"
  | "structural"
  | "microbiome"
  | "longitudinal"
  | "genomic";

export type AncestryBucket =
  | "african"
  | "black-caribbean"
  | "south-asian"
  | "east-asian"
  | "middle-eastern"
  | "hispanic-latino"
  | "white-european"
  | "mixed"
  | "other"
  | "unknown";

export type SexBucket = "female" | "male" | "other" | "unknown";

export type DiagnosisState = "pre-diagnosis" | "on-gfd" | "mixed";

export type LayerScope = {
  id: LayerId;
  label: string;
  dataset: string;
  nSamples: number;
  sitesRepresented: string[];
  ageRange: { min: number; max: number };
  sex: SexBucket[];
  ancestryCovered: AncestryBucket[];
  diagnosisStates: DiagnosisState[];
  tissueMismatch?: string;
  populationLevel?: string;
  notes: string;
};

export const LAYERS: Record<LayerId, LayerScope> = {
  clinical: {
    id: "clinical",
    label: "Clinical",
    dataset: "Kaggle · jackwin07/celiac-disease-coeliac-disease",
    nSamples: 2206,
    sitesRepresented: ["Kaggle aggregate (site unknown)"],
    ageRange: { min: 1, max: 35 },
    sex: ["female", "male"],
    ancestryCovered: ["unknown"],
    diagnosisStates: ["mixed"],
    notes:
      "Paediatric-heavy (60% aged 5–11). T1DM-enriched (83%). No ethnicity recorded — flag ancestry as unknown for every patient.",
  },
  molecular: {
    id: "molecular",
    label: "Molecular",
    dataset: "GEO GSE164883 (Wolf et al. 2021)",
    nSamples: 46,
    sitesRepresented: ["Single site"],
    ageRange: { min: 1, max: 17 },
    sex: ["female", "male"],
    ancestryCovered: ["unknown"],
    diagnosisStates: ["mixed"],
    notes:
      "Paediatric only (ages 1–17). Duodenal biopsy transcriptome across Marsh 0/1/3A/3B/3C (no stage 2).",
  },
  structural: {
    id: "structural",
    label: "Structural",
    dataset: "IBDColEpi · Pettersen 2022 (DataverseNO)",
    nSamples: 251,
    sitesRepresented: ["NTNU / St. Olavs, Trondheim, Norway"],
    ageRange: { min: 18, max: 90 },
    sex: ["female", "male", "unknown"],
    ancestryCovered: ["white-european"],
    diagnosisStates: ["mixed"],
    tissueMismatch:
      "Colon tissue, not duodenum. Methodology-transfer proxy for epithelium segmentation; no CD histology labels.",
    notes:
      "Trondheim biobank colon biopsies with QuPath epithelium + CD3 segmentation. Cambridge NEJM AI 2025 duodenal SOTA is behind a DSA and unavailable.",
  },
  microbiome: {
    id: "microbiome",
    label: "Microbiome",
    dataset: "PRIDE PXD069517 (Abbondio et al. 2026)",
    nSamples: 28,
    sitesRepresented: ["Sassari, Sardinia, Italy (single centre)"],
    ageRange: { min: 22, max: 49 },
    sex: ["female"],
    ancestryCovered: ["white-european"],
    diagnosisStates: ["on-gfd"],
    notes:
      "All female, adult-only, long-term GFD (≥1 year). 14 control + 14 poly-autoimmune. Cannot support paediatric, male, or pre-diagnosis queries.",
  },
  longitudinal: {
    id: "longitudinal",
    label: "Longitudinal",
    dataset: "VDJdb 2025-12-29 (gluten-reactive TCR subset)",
    nSamples: 323,
    sitesRepresented: [
      "Sollid lab (Norway)",
      "US labs",
      "UK labs",
    ],
    ageRange: { min: 18, max: 80 },
    sex: ["female", "male", "unknown"],
    ancestryCovered: ["white-european"],
    diagnosisStates: ["mixed"],
    populationLevel:
      "Reference repertoire aggregated across 13 papers. Not per-patient timecourse — TCRs only.",
    notes:
      "94% HLA-DQ2.5 restricted, remainder DQ8/DQ2.2. Ships cluster PWMs for CDR3 scoring.",
  },
  genomic: {
    id: "genomic",
    label: "Genomic",
    dataset: "Abraham 2014 · PLoS Genet · 228-SNP risk score",
    nSamples: 4000,
    sitesRepresented: [
      "UK2 ImmunoChip (training)",
      "UK1 / Finland / Italy / Netherlands (validation)",
    ],
    ageRange: { min: 18, max: 90 },
    sex: ["female", "male"],
    ancestryCovered: ["white-european"],
    diagnosisStates: ["mixed"],
    notes:
      "L1-regularised logistic regression. European-trained and -validated only; AUC ≈ 0.87 across four European cohorts. HLA dominates: top 10 SNPs by |weight| are all chr6 MHC.",
  },
};

export const LAYER_ORDER: LayerId[] = [
  "clinical",
  "molecular",
  "structural",
  "microbiome",
  "longitudinal",
  "genomic",
];
