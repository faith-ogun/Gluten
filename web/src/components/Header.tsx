import Image from "next/image";
import Link from "next/link";

const nav = [
  { href: "#problem", label: "The gap" },
  { href: "#how", label: "How it works" },
  { href: "#twin", label: "The twin" },
  { href: "#story", label: "Our story" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center" aria-label="Glüten">
          <Image
            src="/logo/gluten-header.png"
            alt="Glüten"
            width={120}
            height={160}
            priority
            className="h-16 w-auto"
          />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-sm text-warm transition hover:text-deep"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/app"
            className="rounded-full bg-deep px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-charcoal"
          >
            Open app
          </Link>
        </div>
      </div>
    </header>
  );
}
