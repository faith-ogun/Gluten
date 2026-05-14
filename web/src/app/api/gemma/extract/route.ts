/**
 * POST /api/gemma/extract
 *
 * Clinician free-text (typed or speech-to-text transcript) → structured
 * FHIR-compatible profile card. Gemma 4 E4B runs locally via Ollama with
 * JSON-schema structured output, so the response is guaranteed to parse.
 *
 * Request:  { mode: "screen" | "twin", text: string }
 * Response: { mode, fields: Partial<ScreenState|TwinState>, reasoning: string,
 *             raw: ScreenExtraction|TwinExtraction, durationMs: number }
 *
 * This is the clinician input hero from CLAUDE.md §3.1 — on-device (Ollama
 * prize track) — and the extractor is deliberately strict: it only fills in
 * fields it is confident about, leaving the wizard form in its existing state
 * for anything the clinician didn't actually say.
 */

import { chatJson, GEMMA_E4B_MODEL } from "@/lib/ollama";
import {
  SCREEN_SCHEMA,
  TWIN_SCHEMA,
  toScreenPatch,
  toTwinPatch,
  type ScreenExtraction,
  type TwinExtraction,
} from "@/lib/forms";

const SCREEN_SYSTEM = `You are a clinical-data extractor for a coeliac disease screening tool.

The clinician has just described a patient they are considering testing for coeliac disease. Convert their free-text description into a structured JSON object matching the provided schema.

DEMOGRAPHICS — fill these whenever the clinician states them:
- age: integer years (e.g. "28 year old" → 28; "aged 35" → 35).
- sex: female / male / other. Map "woman" → female, "man" → male.
- ethnicity: map the clinician's description to ONE of these buckets:
    - african: African / Sub-Saharan African / Black African
    - black-caribbean: Afro-Caribbean / Black Caribbean
    - south-asian: Indian, Pakistani, Bangladeshi, Sri Lankan, Nepali
    - east-asian: Chinese, Japanese, Korean, Vietnamese
    - middle-eastern: Arab, Iranian, Turkish, North African, Mediterranean
    - hispanic-latino: Latin American, Mexican, Hispanic
    - white-european: White British, Irish, European, Caucasian
    - mixed: mixed / multiple heritage
    - other: anything else
  If the clinician says "Black" without more detail, default to "african".

FLAGS — output the symptom cluster IDs the clinician mentioned. Use ONLY these IDs:
- iron-deficiency: chronic / refractory iron deficiency anaemia
- b12-folate: unexplained B12 or folate deficiency
- ibs: IBS diagnosis or chronic GI symptoms
- osteoporosis: early-onset osteoporosis or low bone density
- fatigue: unexplained fatigue persisting >6 months
- dh: dermatitis herpetiformis
- family-hx: family history of autoimmune disease (includes a relative with Hashimoto's, Graves', coeliac, T1DM, lupus, RA, MS)
- infertility: unexplained infertility or recurrent miscarriage
- lfts: unexplained elevated liver enzymes
- t1dm-thyroid: the PATIENT has type 1 diabetes or autoimmune thyroid disease (NOT a relative — those go under family-hx)
- weight-loss: unintentional weight loss
- bloating: chronic bloating, diarrhoea, or steatorrhoea

OUTPUT RULES:
- "reasoning" is a short (≤2 sentences) note citing which phrases mapped to which fields. Helps the clinician verify.
- Omit a field entirely only if the clinician genuinely did not mention it.
- Do NOT invent symptoms. Do NOT output a diagnosis or recommendation.`;

const TWIN_SYSTEM = `You are a clinical-data extractor for a coeliac disease digital twin.

The clinician has described a patient with coeliac-specific test results. Convert their description into a structured JSON object matching the schema.

Rules:
- Only include a field if the clinician clearly stated it.
- tTG: numeric U/mL value for tissue transglutaminase IgA.
- ema: positive / negative / unknown (endomysial antibody IgA).
- hla: dq2.5, dq2.2, dq8, negative, or unknown (HLA typing).
- marsh: 0, 1, 2, 3a, 3b, or 3c (modified Marsh-Oberhuber histology grade).
- iel: intraepithelial lymphocytes per 100 enterocytes (numeric).
- gfdMonths: months the patient has been on a gluten-free diet (0 if pre-diagnosis).
- notes: one short sentence summarising anything clinically relevant not captured by the structured fields (family history, comorbidities, symptom burden). Empty string if none.
- reasoning: ≤2 sentences citing which phrases mapped to which fields.
- Do NOT invent values.`;

type ExtractRequest =
  | { mode: "screen"; text: string }
  | { mode: "twin"; text: string };

export async function POST(req: Request) {
  const started = Date.now();
  let body: ExtractRequest;
  try {
    body = (await req.json()) as ExtractRequest;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body || (body.mode !== "screen" && body.mode !== "twin")) {
    return Response.json({ error: "mode must be 'screen' or 'twin'" }, { status: 400 });
  }
  if (typeof body.text !== "string" || body.text.trim().length < 3) {
    return Response.json({ error: "text must be a non-empty string" }, { status: 400 });
  }

  try {
    if (body.mode === "screen") {
      const extraction = await chatJson<ScreenExtraction>({
        model: GEMMA_E4B_MODEL,
        messages: [
          { role: "system", content: SCREEN_SYSTEM },
          {
            role: "user",
            content:
              "35 year old white Irish man, low B12 despite supplementation, unintentional 4 kg weight loss over 6 months, no family autoimmune history.",
          },
          {
            role: "assistant",
            content: JSON.stringify({
              age: 35,
              sex: "male",
              ethnicity: "white-european",
              flags: ["b12-folate", "weight-loss"],
              reasoning:
                "Age 35, male ('man'), white-european ('white Irish'). B12 deficiency → b12-folate; unintentional 4kg weight loss → weight-loss.",
            }),
          },
          {
            role: "user",
            content: "Adult male with some abdominal discomfort.",
          },
          {
            role: "assistant",
            content: JSON.stringify({
              age: null,
              sex: "male",
              ethnicity: null,
              flags: [],
              reasoning:
                "Sex male ('male'). No specific age, ethnicity, or red-flag symptoms clearly stated; abdominal discomfort alone does not meet any cluster criterion.",
            }),
          },
          { role: "user", content: body.text.trim() },
        ],
        schema: SCREEN_SCHEMA,
        options: { temperature: 0.1, num_predict: 1500 },
      });
      return Response.json({
        mode: "screen",
        fields: toScreenPatch(extraction),
        reasoning: extraction.reasoning,
        raw: extraction,
        durationMs: Date.now() - started,
      });
    }

    const extraction = await chatJson<TwinExtraction>({
      model: GEMMA_E4B_MODEL,
      messages: [
        { role: "system", content: TWIN_SYSTEM },
        { role: "user", content: body.text.trim() },
      ],
      schema: TWIN_SCHEMA,
      options: { temperature: 0.1, num_predict: 600 },
    });
    return Response.json({
      mode: "twin",
      fields: toTwinPatch(extraction),
      reasoning: extraction.reasoning,
      raw: extraction,
      durationMs: Date.now() - started,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: `extraction failed: ${msg}`, durationMs: Date.now() - started },
      { status: 502 },
    );
  }
}
