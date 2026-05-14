const layers = [
  {
    name: "Molecular",
    conf: 0.72,
    source: "GSE164883 (GEO)",
    note: "Transcriptomic panel, European cohort",
  },
  {
    name: "Structural",
    conf: 0.85,
    source: "IBDColEpi + Cambridge WSI",
    note: "H&E and CD3 whole-slide training data",
  },
  {
    name: "Clinical",
    conf: 0.61,
    source: "Celiac Disease Dataset (Kaggle)",
    note: "Serology, symptoms, HLA typing",
  },
  {
    name: "Microbiome",
    conf: 0.12,
    source: "PMC12877843 (2026)",
    note: "Near-zero representation for this demographic",
  },
  {
    name: "Longitudinal",
    conf: 0.28,
    source: "PMC7898595 (TCR repertoires)",
    note: "Sparse coverage over time",
  },
  {
    name: "Genomic",
    conf: 0.45,
    source: "PMC3923679 (~200 SNPs)",
    note: "HLA-DQ2/DQ8 plus genomic risk score",
  },
];

function barColor(v: number) {
  if (v >= 0.7) return "bg-safe";
  if (v >= 0.4) return "bg-wheat";
  return "bg-alert/70";
}

export default function TwinSim() {
  return (
    <div className="rounded-3xl border border-charcoal/80 bg-deep p-6 text-cream shadow-[0_40px_100px_-40px_rgba(0,0,0,0.6)] sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-widest text-wheat">
            <span className="h-1.5 w-1.5 rounded-full bg-wheat" />
            Personalised projection
          </div>
          <h3 className="serif text-2xl sm:text-3xl">
            6-month strict gluten-free trajectory
          </h3>
          <p className="mt-2 text-sm text-cream/70">
            For a patient with HLA-DQ2.5, Marsh 3b histology, tTG-IgA 84 U/mL,
            the disease model projects:
          </p>
          <p className="mt-2 font-mono text-sm text-wheat">
            marsh 3b &rarr; 1 · IEL 42 &rarr; &lt;25 per 100 enterocytes · tTG &rarr; &lt;20
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
          <div className="text-[10px] uppercase tracking-widest text-cream/50">
            Overall confidence
          </div>
          <div className="serif text-4xl text-alert">0.34</div>
          <div className="text-[11px] text-cream/60">
            demographic match: low
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {layers.map((l) => (
          <div
            key={l.name}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-cream">{l.name}</span>
              <span className="font-mono text-sm tabular-nums text-wheat">
                {l.conf.toFixed(2)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${barColor(l.conf)}`}
                style={{ width: `${l.conf * 100}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-cream/50">
              <span>{l.note}</span>
              <span className="font-mono text-wheat/70">{l.source}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-wheat/30 bg-wheat/5 p-4 text-[13px] leading-relaxed text-wheat/90">
        The prediction is the product. The confidence flag is the bonus: it
        tells this patient&apos;s clinician that three of six layers have
        near-zero representation for her demographic, and tells researchers
        exactly where to direct the next study.
      </div>
    </div>
  );
}
