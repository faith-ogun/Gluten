import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label="Glüten">
          <Image
            src="/logo/gluten-header.png"
            alt="Glüten"
            width={120}
            height={160}
            priority
            className="h-12 w-auto"
          />
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-warm sm:inline">
            clinician workspace
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-deep/10 bg-cream px-4 py-2 text-xs text-warm transition hover:border-deep/30 hover:text-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to site
          </Link>
        </div>
      </div>
    </header>
  );
}
