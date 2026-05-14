import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Mic,
  FileText,
  HeartHandshake,
  Sparkles,
  Stethoscope,
  ShieldAlert,
} from "lucide-react";

function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8h4.56v14H.22V8zm7.32 0h4.37v1.92h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.47 3.04 5.47 7V22h-4.56v-6.2c0-1.48-.03-3.38-2.06-3.38-2.06 0-2.38 1.61-2.38 3.27V22H7.54V8z" />
    </svg>
  );
}

function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.96 3.22 9.16 7.69 10.64.56.1.77-.24.77-.54 0-.27-.01-1.15-.02-2.08-3.13.68-3.79-1.33-3.79-1.33-.51-1.29-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1.01 1.72 2.64 1.22 3.29.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.11 1.15.9-.25 1.87-.37 2.83-.38.96.01 1.93.13 2.83.38 2.16-1.45 3.11-1.15 3.11-1.15.61 1.55.23 2.7.11 2.98.72.78 1.16 1.79 1.16 3.02 0 4.33-2.64 5.29-5.15 5.57.4.35.76 1.02.76 2.06 0 1.49-.01 2.69-.01 3.06 0 .3.2.65.78.54 4.47-1.48 7.69-5.68 7.69-10.64C23.25 5.48 18.27.5 12 .5z" />
    </svg>
  );
}
import Header from "@/components/Header";
import Reveal from "@/components/Reveal";
import GapCard from "@/components/GapCard";
import TwinSim from "@/components/TwinSim";
import HeroVisual from "@/components/HeroVisual";

export default function Home() {
  return (
    <>
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden bg-paper">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-wheat/20 blur-3xl" />
        <div className="absolute -right-40 top-60 h-[420px] w-[420px] rounded-full bg-wheat-light/50 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pt-24 pb-28 sm:pt-32 sm:pb-36 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <Reveal>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-cream/70 px-4 py-1.5 text-xs text-warm backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-wheat" />
                Twin #1 of the 100 Autoimmune Twins Project
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="serif text-5xl leading-[1.02] tracking-tight text-deep sm:text-7xl lg:text-[84px]">
                Your body.<br />
                Your data.<br />
                <span className="italic text-wheat-deep">Your twin.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-warm sm:text-xl">
                The first open-source coeliac disease digital twin. Glüten
                screens for undiagnosed coeliac disease from non-specific
                symptoms, then runs a six-dimension model of the disease to
                project each patient&apos;s trajectory and show exactly where
                the evidence runs out.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/app"
                  className="group inline-flex items-center gap-2 rounded-full bg-deep px-7 py-4 text-sm font-medium text-cream transition hover:bg-charcoal"
                >
                  Open the app
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 rounded-full border border-deep/20 bg-cream/60 px-7 py-4 text-sm font-medium text-deep backdrop-blur transition hover:border-deep/40"
                >
                  See how it works
                </a>
              </div>
            </Reveal>
          </div>

          <div className="relative flex items-center justify-center lg:col-span-5">
            <HeroVisual />
          </div>

          <div className="lg:col-span-12">
            <Reveal delay={0.3}>
              <div className="mt-16 grid gap-6 border-t border-line pt-10 sm:grid-cols-3">
                {[
                  {
                    k: "1 in 100",
                    v: "people live with coeliac disease globally",
                  },
                  {
                    k: "~70%",
                    v: "remain undiagnosed worldwide",
                  },
                  {
                    k: "126 vs 2,618",
                    v: "African vs European coeliac studies indexed in PubMed",
                  },
                ].map((s) => (
                  <div key={s.k}>
                    <div className="serif text-4xl text-deep">{s.k}</div>
                    <div className="mt-2 max-w-xs text-sm text-warm">
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section id="problem" className="relative border-y border-line bg-cream">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <div className="grid gap-16 lg:grid-cols-12">
            <Reveal className="lg:col-span-5">
              <div className="sticky top-28">
                <div className="mb-4 text-[11px] uppercase tracking-widest text-warm">
                  The problem
                </div>
                <h2 className="serif text-4xl leading-tight text-deep sm:text-5xl">
                  What we know about coeliac disease isn&apos;t evenly
                  distributed.
                </h2>
                <p className="mt-6 text-base leading-relaxed text-warm">
                  Coeliac disease is not rare. It affects one in every hundred
                  people. It is, however, one of the most underdiagnosed
                  conditions in the world, and the evidence base behind its
                  diagnosis is narrower than most patients realise.
                </p>
              </div>
            </Reveal>

            <div className="space-y-4 lg:col-span-7">
              {[
                {
                  n: "01",
                  t: "Diagnostic bias",
                  b: "tTG-IgA serology carries higher false-negative rates in Black patients. The best biopsy AI model, at 96% accuracy, was trained exclusively on four NHS trusts in the UK.",
                },
                {
                  n: "02",
                  t: "A research void",
                  b: "Of roughly 32,700 coeliac disease papers in PubMed, about 2,618 study European populations. Only 126 study African populations. Zero validate coeliac diagnostic AI on non-European cohorts.",
                },
                {
                  n: "03",
                  t: "Patient data that never comes home",
                  b: "Symptoms are logged in free-text on Reddit, in WhatsApp groups, in notebooks. 79% of patients use digital media to manage their disease. None of it is structured. None of it feeds back into the science.",
                },
                {
                  n: "04",
                  t: "The pre-diagnostic gap",
                  b: "Most of the 70% undiagnosed never reach the test. They present with chronic anaemia, unexplained fatigue, early-onset osteoporosis, an IBS label. Individually routine; together a recognisable cluster. Average diagnostic delay: 6–10 years of preventable damage.",
                },
              ].map((item, i) => (
                <Reveal key={item.n} delay={i * 0.08}>
                  <div className="group rounded-3xl border border-line bg-wheat-pale/50 p-7 transition hover:border-wheat hover:bg-wheat-pale">
                    <div className="flex items-start gap-6">
                      <div className="font-mono text-xs text-wheat-deep">
                        {item.n}
                      </div>
                      <div>
                        <h3 className="serif text-2xl text-deep">{item.t}</h3>
                        <p className="mt-2 text-[15px] leading-relaxed text-warm">
                          {item.b}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative bg-paper">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <Reveal>
            <div className="max-w-3xl">
              <div className="mb-4 text-[11px] uppercase tracking-widest text-warm">
                How it works
              </div>
              <h2 className="serif text-4xl leading-tight text-deep sm:text-5xl">
                A clinician&apos;s workflow, built around the disease twin.
              </h2>
              <p className="mt-5 text-lg text-warm">
                One web app. One user: the gastroenterologist, the GP, the
                dietitian. Two entry points into the same engine — screen a
                patient with non-specific symptoms, or go straight to the twin
                with confirmed data. Voice or text in, FHIR-compatible profile
                out, personalised projection back.
              </p>
            </div>
          </Reveal>

          {/* STEP 00 — SCREENING ENTRY POINT */}
          <Reveal delay={0.05}>
            <div className="mt-16 overflow-hidden rounded-3xl border border-wheat/40 bg-gradient-to-br from-wheat-pale to-cream p-7 sm:p-9">
              <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-7">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-wheat/50 bg-cream/80 px-3 py-1 text-[11px] uppercase tracking-widest text-wheat-deep">
                    <Stethoscope className="h-3.5 w-3.5" />
                    Step 00 · Screen · optional entry
                  </div>
                  <h3 className="serif text-2xl leading-snug text-deep sm:text-3xl">
                    &ldquo;Should I test this patient for coeliac?&rdquo;
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-warm">
                    The GP enters non-specific symptoms — chronic iron
                    deficiency, unexplained fatigue, an IBS label, early-onset
                    osteoporosis, family history. Glüten cross-references
                    against ACG, BSG and ESsCD red-flag clusters and returns a
                    coeliac probability plus a recommended next test.
                  </p>
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-wheat/30 bg-cream/70 p-4">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-wheat-deep" />
                    <p className="text-[13px] leading-relaxed text-deep">
                      <span className="font-medium">
                        Demographic-aware test advisory.
                      </span>{" "}
                      tTG-IgA carries higher false-negative rates in Black
                      patients. If serology is negative but clinical suspicion
                      remains, Glüten flags EMA testing or direct biopsy
                      referral — cited to PMC11308727, not generated.
                    </p>
                  </div>
                </div>
                <div className="lg:col-span-5">
                  <div className="rounded-2xl border border-line bg-cream p-5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-warm">
                      Example screen · 28F, African
                    </div>
                    <ul className="mt-3 space-y-1.5 font-mono text-[12px] text-deep">
                      <li>· chronic iron deficiency anaemia (2y)</li>
                      <li>· persistent fatigue</li>
                      <li>· IBS diagnosis</li>
                      <li>· family hx autoimmune thyroid</li>
                    </ul>
                    <div className="mt-4 border-t border-line pt-4">
                      <div className="text-[11px] uppercase tracking-widest text-warm">
                        Risk
                      </div>
                      <div className="serif mt-1 text-xl text-deep">
                        Moderate–High · 4 red-flag signals
                      </div>
                      <div className="mt-2 text-[12px] text-warm">
                        Recommend tTG-IgA serology.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-7 flex items-center gap-3 text-[11px] uppercase tracking-widest text-warm">
                <div className="h-px flex-1 bg-line" />
                If tests come back, the same app runs the full twin
                <div className="h-px flex-1 bg-line" />
              </div>
            </div>
          </Reveal>

          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Mic,
                step: "Step 01",
                title: "Input",
                body: "The clinician speaks or types whatever data they have, serology, HLA type, Marsh score, demographics. Gemma 4 E4B structures it into a FHIR-compatible profile card. 140+ languages. Lagos to Dublin.",
              },
              {
                icon: FileText,
                step: "Step 02",
                title: "Query the twin",
                body: "Only the layers with data activate. Gemma 4 31B cross-references the patient profile against six dimensions of the coeliac disease model, with PubMed RAG for literature context.",
              },
              {
                icon: Sparkles,
                step: "Step 03",
                title: "Project + flag",
                body: "The twin returns a personalised trajectory (projected Marsh, IEL, tTG) alongside per-layer confidence scores that reveal exactly which evidence is thin for this specific patient.",
              },
              {
                icon: HeartHandshake,
                step: "Step 04",
                title: "Contribute",
                body: "With patient consent, the de-identified structured profile is added back to the disease model under the clinician's institutional governance. Coverage grows. Confidence improves.",
              },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="group h-full rounded-3xl border border-line bg-cream p-6 transition hover:-translate-y-1 hover:border-wheat hover:shadow-[0_30px_60px_-30px_rgba(45,42,36,0.25)]">
                  <div className="mb-8 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-wheat/15 text-wheat-deep ring-1 ring-wheat/30">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-warm">
                    {s.step}
                  </div>
                  <h3 className="serif mt-1 text-2xl text-deep">{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-warm">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-20">
            <Reveal>
              <GapCard />
            </Reveal>
          </div>
        </div>
      </section>

      {/* TWIN */}
      <section id="twin" className="relative bg-cream">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <div className="grid gap-14 lg:grid-cols-12">
            <Reveal className="lg:col-span-5">
              <div className="sticky top-28">
                <div className="mb-4 text-[11px] uppercase tracking-widest text-warm">
                  The disease twin
                </div>
                <h2 className="serif text-4xl leading-tight text-deep sm:text-5xl">
                  A model of the disease. A prediction for you.
                </h2>
                <p className="mt-6 text-base leading-relaxed text-warm">
                  Glüten is a disease digital twin, not a patient digital
                  twin. It is a composite model of coeliac disease built
                  across six dimensions, drawing on thousands of patients.
                  Each layer is a different view of the same disease, not a
                  separate record for the same person.
                </p>
                <p className="mt-4 text-base leading-relaxed text-warm">
                  When the clinician inputs a patient&apos;s data, even
                  partial data from just one or two layers, Glüten runs that
                  profile against the composite model to generate a
                  personalised projection of the patient&apos;s trajectory.
                  The per-layer confidence score then tells the clinician
                  exactly how much of the model was relevant to someone like
                  this patient.
                </p>
                <div className="mt-8 flex items-center gap-3 text-xs text-warm">
                  <div className="h-px w-10 bg-wheat" />
                  A system twin for coeliac disease
                </div>
              </div>
            </Reveal>

            <Reveal className="lg:col-span-7 space-y-5" delay={0.1}>
              {/* Disease twin → patient input → prediction flow */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    step: "01",
                    title: "Disease model",
                    body: "A composite of coeliac disease built from six data layers, drawing on thousands of patients across public datasets.",
                  },
                  {
                    step: "02",
                    title: "Patient input",
                    body: "The clinician enters whatever data they have, serology, HLA type, a single biopsy. The twin accepts partial input.",
                  },
                  {
                    step: "03",
                    title: "Personalised projection",
                    body: "The patient's profile runs against the model. The clinician gets a trajectory prediction plus how confident the model is for someone like this patient.",
                  },
                ].map((c) => (
                  <div
                    key={c.step}
                    className="rounded-2xl border border-line bg-wheat-pale/50 p-5"
                  >
                    <div className="font-mono text-[11px] tracking-widest text-wheat-deep">
                      {c.step}
                    </div>
                    <div className="serif mt-1 text-lg text-deep">
                      {c.title}
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-warm">
                      {c.body}
                    </p>
                  </div>
                ))}
              </div>
              <TwinSim />
            </Reveal>
          </div>

          {/* DATA PROVENANCE */}
          <div className="mt-24 border-t border-line pt-12">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-widest text-warm">
                  Data provenance
                </div>
                <h3 className="serif text-3xl text-deep">
                  Every layer is traceable to a public dataset.
                </h3>
              </div>
              <p className="max-w-md text-sm text-warm">
                Glüten is built on curated, citable, open data. No layer is a
                black box.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  t: "Molecular",
                  d: "Transcriptomic panel, BTLA and LAG3 immune checkpoint markers",
                  source: "GSE164883",
                  origin: "GEO (NCBI)",
                },
                {
                  t: "Structural",
                  d: "WSI histopathology, villous atrophy, Marsh classification",
                  source: "IBDColEpi + Cambridge benchmark",
                  origin: "Kaggle / NEJM AI 2025",
                },
                {
                  t: "Clinical",
                  d: "Serology, symptoms, HLA typing, dietary compliance",
                  source: "Celiac Disease Dataset",
                  origin: "Kaggle (jackwin07)",
                },
                {
                  t: "Microbiome",
                  d: "Fecal metaproteome, poly-autoimmunity signatures",
                  source: "PMC12877843",
                  origin: "PubMed Central, 2026",
                },
                {
                  t: "Longitudinal",
                  d: "Intestinal T-cell receptor repertoires over time",
                  source: "PMC7898595",
                  origin: "PubMed Central, 2021",
                },
                {
                  t: "Genomic",
                  d: "HLA-DQ2/DQ8 plus ~200 SNP risk score across populations",
                  source: "PMC3923679",
                  origin: "PubMed Central",
                },
              ].map((l) => (
                <div
                  key={l.t}
                  className="rounded-2xl border border-line bg-wheat-pale/50 p-5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="serif text-lg text-deep">{l.t}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-wheat-deep">
                      {l.origin}
                    </div>
                  </div>
                  <div className="mt-1 text-[13px] text-warm">{l.d}</div>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-cream px-2.5 py-1 font-mono text-[11px] text-deep">
                    {l.source}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STORY */}
      <section
        id="story"
        className="relative overflow-hidden border-t border-line bg-deep text-cream"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(212,168,67,0.18),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-16 px-6 py-24 sm:py-32 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <div className="mb-4 text-[11px] uppercase tracking-widest text-wheat">
              Our story
            </div>
            <h2 className="serif text-4xl leading-tight sm:text-5xl">
              Built from inside the gap.
            </h2>
          </Reveal>
          <Reveal className="lg:col-span-7" delay={0.1}>
            <div className="space-y-5 text-lg leading-relaxed text-cream/80">
              <p>
                Glüten is built by Faith Ogundimu, a first-year PhD researcher
                at RCSI&apos;s Genomic Oncology Research Group, and a coeliac
                patient. African. Living in Ireland.
              </p>
              <p>
                When she searched PubMed for studies on coeliac disease in
                people like her, she found almost nothing. Glüten is a direct
                response to that absence: a tool designed to measure the gap,
                and to close it one structured profile at a time.
              </p>
              <p className="text-wheat">
                If the research you need doesn&apos;t exist yet, you can help
                build it.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-paper">
        <div className="mx-auto max-w-5xl px-6 py-28 text-center sm:py-36">
          <Reveal>
            <h2 className="serif text-5xl leading-tight text-deep sm:text-6xl">
              The cost of missing research<br />
              <span className="italic text-wheat-deep">
                should be measurable.
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-warm">
              Glüten doesn&apos;t pretend to have every answer. It makes the
              cost of not having them visible, and gives every consultation a
              way to close the gap.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href="/app"
                className="group inline-flex items-center gap-2 rounded-full bg-deep px-8 py-4 text-sm font-medium text-cream transition hover:bg-charcoal"
              >
                Open the app
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="https://github.com"
                className="inline-flex items-center gap-2 rounded-full border border-deep/20 bg-cream/60 px-8 py-4 text-sm font-medium text-deep transition hover:border-deep/40"
              >
                View on GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line bg-cream">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-14 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Image
              src="/logo/gluten-footer.png"
              alt="Glüten"
              width={300}
              height={99}
              className="h-20 w-auto"
            />
            <p className="mt-4 text-sm text-warm">
              Bridging humans and data through digital twins for chronic
              autoimmune disease.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-widest text-warm">
                Product
              </div>
              <ul className="space-y-2 text-deep">
                <li>
                  <Link href="/app" className="hover:text-wheat-deep">
                    Open app
                  </Link>
                </li>
                <li>
                  <a href="#how" className="hover:text-wheat-deep">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#twin" className="hover:text-wheat-deep">
                    The twin
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-widest text-warm">
                Research
              </div>
              <ul className="space-y-2 text-deep">
                <li>
                  <a href="#problem" className="hover:text-wheat-deep">
                    The gap
                  </a>
                </li>
                <li>
                  <a href="#story" className="hover:text-wheat-deep">
                    Our story
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-wheat-deep">
                    Publications
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-widest text-warm">
                Contact
              </div>
              <ul className="flex items-center gap-3">
                <li>
                  <a
                    href="https://www.linkedin.com/in/faith-ogundimu/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="LinkedIn"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-cream text-deep transition hover:border-wheat hover:text-wheat-deep"
                  >
                    <LinkedInIcon className="h-4 w-4" />
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    aria-label="GitHub"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-cream text-deep transition hover:border-wheat hover:text-wheat-deep"
                  >
                    <GitHubIcon className="h-4 w-4" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-6 py-6 text-xs text-warm sm:flex-row">
            <div>
              © {new Date().getFullYear()} Glüten. A research prototype, not a
              clinical decision-making tool.
            </div>
            <div>Your body. Your data. Your twin.</div>
          </div>
        </div>
      </footer>
    </>
  );
}
