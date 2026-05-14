import { cn } from "@/lib/cn";

type Row = {
  label: string;
  value: number;
  max: number;
  kind: "void" | "low" | "mid" | "high";
};

// Scope: coeliac disease only. Figures sourced from PubMed queries
// comparing European vs African cohort representation.
// PubMed counts queried directly (coeliac/celiac disease filtered by population).
const MAX = 2700;
const rows: Row[] = [
  {
    label: "Coeliac studies in European populations",
    value: 2618,
    max: MAX,
    kind: "high",
  },
  {
    label: "Coeliac studies in African populations",
    value: 126,
    max: MAX,
    kind: "low",
  },
  {
    label: "Coeliac diagnostic AI validated on non-European cohorts",
    value: 0,
    max: MAX,
    kind: "void",
  },
  {
    label: "Genetic risk scores validated in African populations",
    value: 0,
    max: MAX,
    kind: "void",
  },
  {
    label: "Longitudinal patient-reported outcomes, underserved populations",
    value: 0,
    max: MAX,
    kind: "void",
  },
];

function formatNum(n: number) {
  return n === 0 ? "0" : n.toLocaleString();
}

export default function GapCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-wheat-pale/60 p-6 shadow-[0_30px_80px_-40px_rgba(45,42,36,0.35)] sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-line bg-cream px-3 py-1 text-[11px] uppercase tracking-widest text-warm">
            <span className="h-1.5 w-1.5 rounded-full bg-wheat" />
            Evidence gap report
          </div>
          <h3 className="serif text-2xl text-deep sm:text-3xl">
            What the model knows about this patient
          </h3>
          <p className="mt-1 text-sm text-warm">
            Patient profile: African, female, 21, coeliac disease
          </p>
        </div>
        <div className="hidden rounded-2xl border border-line bg-cream px-4 py-3 text-right sm:block">
          <div className="text-[10px] uppercase tracking-widest text-warm">
            Published papers
          </div>
          <div className="serif text-3xl text-deep">~32,723</div>
          <div className="text-[11px] text-warm">coeliac papers in PubMed</div>
        </div>
      </div>

      <div className="space-y-4">
        {rows.map((r) => {
          const pct = Math.max(
            (r.value / r.max) * 100,
            r.value === 0 ? 0 : 1.2
          );
          return (
            <div key={r.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
                <span className="text-deep">{r.label}</span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    r.kind === "void" && "text-alert",
                    r.kind === "low" && "text-warm",
                    r.kind === "high" && "text-deep"
                  )}
                >
                  {formatNum(r.value)} {r.kind === "void" && "· no evidence"}
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-cream ring-1 ring-line">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    r.kind === "high" && "bg-deep",
                    r.kind === "low" && "bg-wheat",
                    r.kind === "void" && "bg-alert/70"
                  )}
                  style={{ width: `${pct}%` }}
                />
                {r.kind === "void" && (
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgba(201,68,50,0.15)_6px_12px)]" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-wheat-deep/40 bg-cream/60 p-4">
        <div className="max-w-sm text-sm text-warm">
          The red bars aren&apos;t a dead end. They&apos;re where the next
          study should go. Every de-identified profile a clinician contributes
          measurably shrinks one of them.
        </div>
        <button className="rounded-full bg-deep px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-charcoal">
          Add to disease model
        </button>
      </div>
    </div>
  );
}
