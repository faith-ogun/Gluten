# Glüten

**Clinician-facing digital twin for coeliac disease.** Built for the Gemma 4 Good Hackathon, 2026.

> *Your body. Your data. Your twin.*
> Twin #1 of The 100 Autoimmune Twins Project.

**Live demo:** https://gluten--gluten-gemma4.europe-west4.hosted.app
(no login; the clinician workspace is at `/app`)

---

## What it does

A single web app with two entry points and one engine.

- **Screen mode.** A GP enters non-specific symptoms (chronic anaemia, fatigue, IBS, early osteoporosis, family history). Gemma 4 E4B, on-device via Ollama, structures the dictation into a FHIR-compatible profile. The system returns a coeliac probability against published guideline criteria, plus a demographic-aware test advisory (e.g. tTG-IgA has higher false-negative rates in Black patients).
- **Twin mode.** A GP enters confirmed CD data — serology, HLA, histology, demographics. Gemma 4 31B (256K context) cross-references the profile against six biological layers of the disease, retrieving cited PubMed evidence per layer. The output is a personalised trajectory projection alongside a per-layer confidence breakdown. For under-represented ancestries, four of six layers collapse to near-zero confidence by construction — the equity gap, made measurable inside the consultation.
- **Contribute.** With patient consent, the clinician sends a de-identified structured profile to the global research pool. PHI is stripped server-side (ages → decades, tTG/IEL/GFD → clinical bins, free text dropped, allow-listed flags only). The HIPAA Safe Harbor scan runs as a defence-in-depth check before write.

## The six layers

| Layer | Dataset | What it provides |
|---|---|---|
| Molecular | GSE164883 (PMID 33806322) | Transcriptomic signatures across Marsh stages |
| Structural | IBDColEpi (DOI 10.18710/TLA01U) + Gemma 4 E4B Marsh classifier | Methodology-transferable epithelium segmentation + per-patch Marsh prediction |
| Clinical | Kaggle Coeliac Disease Dataset | Serology, EMA, HLA, demographics |
| Microbiome | Abbondio et al. 2026 (PRIDE PXD069517) | Per-patient metaproteome on GFD |
| Longitudinal | VDJdb 2025-12-29 | Gluten-reactive TCR reference repertoire |
| Genomic | Abraham et al. 2014 (PMC3923679) | 228-SNP polygenic risk score |

Per-layer confidence is computed deterministically from how well the patient's demographic + clinical context matches each dataset's documented scope. The model writes narratives, not confidence numbers.

## How Gemma 4 is used

1. **Gemma 4 E4B (local via Ollama)** — clinician voice/text → FHIR-compatible JSON. 140+ languages. Raw narrative never leaves the device.
2. **Gemma 4 31B (Ollama Cloud)** — six-layer twin reasoning, grounded in retrieved PubMed abstracts, with PMIDs constrained to a closed vocabulary so fabricated citations cannot reach the user.
3. **Gemma 4 E4B fine-tuned via Unsloth QLoRA** — Marsh-grade classification from HE-stained biopsy patches. 70% / Marsh-3b F1 0.84 on a 400-patch held-out test set (training eval); 64.5% / F1 0.83 on the merged-fp16 model that serves the live demo. Targets the Unsloth special-technology track. Deployed as a Modal-hosted FastAPI sidecar.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                Next.js web app (web/)                │
│  /app  ── clinician workspace                        │
│  /     ── landing                                    │
│                                                      │
│  /api/gemma/screen       Screen-mode risk scoring    │
│  /api/gemma/twin         Six-layer twin reasoning    │
│  /api/medgemma/marsh     Marsh classifier proxy      │
│  /api/contribute         De-identified Firestore     │
│  /api/rag                PubMed-RAG search           │
└─────────┬────────────────────┬────────────────┬──────┘
          │                    │                │
   ┌──────▼─────┐      ┌──────▼──────┐   ┌─────▼──────┐
   │  Ollama    │      │  Modal      │   │  Firestore │
   │            │      │  sidecar    │   │  (gluten-  │
   │  gemma4:   │      │  (services/ │   │   gemma4)  │
   │   e4b,     │      │  marsh-     │   │            │
   │   31b-     │      │  sidecar/)  │   │  ADC auth  │
   │   cloud    │      │             │   │  in prod   │
   │            │      │  Merged     │   │            │
   │  nomic-    │      │  Gemma 4    │   │  Service-  │
   │  embed-    │      │  E4B fp16 + │   │  account   │
   │  text      │      │  LoRA on    │   │  in dev    │
   │            │      │  Cloud Run  │   │            │
   │            │      │  L4 GPU     │   │            │
   └────────────┘      └─────────────┘   └────────────┘
```

## Repo layout

```
.
├── web/                     Next.js 16 clinician workspace + APIs
│   ├── src/app/             pages (/, /app) + route handlers (/api/*)
│   ├── src/components/      MarshTile, ContributePanel, PatientsPanel, TwinSim, GemmaDictate
│   ├── src/lib/             deidentify, firestore, ollama, rag, twin, confidence, layers, forms
│   └── apphosting.yaml      Firebase App Hosting config
├── services/marsh-sidecar/  Modal app serving the merged Gemma 4 E4B Marsh classifier
├── notebooks/               Kaggle training (v1, v2) and stratified audit (v3) notebooks
├── scripts/                 Data prep + stratified audit
└── animations/              Remotion source for the demo video
```

## Running it locally

Two terminals.

**Terminal 1 — Ollama:**
```bash
# Install Ollama from https://ollama.com
ollama pull gemma4:e4b
ollama pull nomic-embed-text
# Ollama auto-starts as a menu-bar app on macOS.
```

**Terminal 2 — the web app:**
```bash
cd web
npm install

# .env.local needs:
#   OLLAMA_API_KEY=<your-ollama-cloud-key>     (for gemma4:31b-cloud)
#   MARSH_SIDECAR_URL=<your-modal-deploy-url>  (optional; falls back to demo mode)
#   FIREBASE_SERVICE_ACCOUNT_JSON='{...}'      (optional; falls back to local JSONL)

npm run dev
# open http://localhost:3000/app
```

**Marsh sidecar (optional):**
```bash
cd services/marsh-sidecar
pip install modal
modal token new
modal deploy modal_app.py
# Copy the printed URL into web/.env.local as MARSH_SIDECAR_URL
```

**Re-train the Marsh classifier:**
Open `notebooks/gluten-gemma4-marsh-qlora-v2.ipynb` on Kaggle. Attach the `faithogun/gluten-ibdcolepi-sample` dataset, set the `HF_TOKEN` secret (license accepted on `google/gemma-4-E4B-it`), Save & Run All. ~30 min on a free T4. The notebook saves a merged fp16 checkpoint to HuggingFace.

## Tests

```bash
cd web
npx tsx --test src/lib/deidentify.test.ts
```

21 tests covering the de-identification engine + HIPAA Safe Harbor scanner. All pass.

## Strategic decisions

- **Colon data, transferable to duodenum.** Chose IBDColEpi (CC0) over the Cambridge duodenal benchmark (NEJM AI 2025, access-restricted IRAS 162057). Pettersen et al. explicitly name coeliac as an applicable use case. A CD AI built on access-restricted data is one most of the world cannot validate.
- **Weak-supervision proxy labels with pathologist-like errors.** IBDColEpi ships epithelium-segmentation masks, not Marsh grades. Pseudo-labels derived from epithelium-fraction quantile binning. Errors confine to adjacent grades, mirroring 73-80% inter-pathologist agreement. The pseudo-labelling methodology is open so the next group can retrain on pathologist-validated grades in 30 minutes.
- **European-only genomic layer as a first-class confidence signal.** Rather than silently apply Abraham 2014's 228-SNP score to non-European patients, Glüten makes the demographic mismatch visible. Honest about who it works for, by design.
- **Compute access as a finding.** The Marsh classifier originally targeted MedGemma 1.5 4B. Free Kaggle T4 hardware cannot backpropagate through MedGemma's bf16 SigLIP encoder. Pivoted to Gemma 4 E4B. Failed compute on free hardware is itself a finding about who can validate medical AI on commodity infrastructure.

## Stratified bias audit

Run `python3 scripts/stratified_audit.py` after the v3 audit notebook produces `results/marsh_stratified_predictions.csv`. Outputs:
- `results/marsh_stratified.csv` — per-stratum metrics table
- `results/marsh_stratified.png` — per-class F1, per-WSI accuracy, per-quintile accuracy
- `results/marsh_stratified_summary.md` — paragraph-form summary

Per-WSI accuracy spans 0.00–1.00 (σ=0.21) across 35 slides from the same hospital, same scanner. Cross-site generalisation is the load-bearing unknown the field has no answer for, because the SOTA Cambridge benchmark has not released per-demographic metrics. Glüten surfaces that gap at inference time.

## Disclaimer

Glüten is a research prototype and a clinical decision-support tool. Outputs are model-based extrapolations of published evidence, never diagnoses. The clinician remains responsible for all testing and management decisions, under their existing institutional governance (HIPAA, GDPR, RCSI ethics).

## License

See [LICENSE](LICENSE).

## Builder

Faith Ogundimu — 1st-year PhD researcher, RCSI Genomic Oncology Research Group.
Coeliac patient. African. Living in Ireland.
