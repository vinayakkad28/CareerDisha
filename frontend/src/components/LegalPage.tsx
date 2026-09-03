import Link from "next/link";

/** Shared chrome for the static legal pages (/privacy, /terms, /contact).
 *
 * Deliberately a Server Component with no client interactivity, so these pages
 * render fully on the server: they are the pages a regulator, a payment
 * provider, or a cautious parent will look for, and they must be readable
 * without JavaScript.
 */
export default function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-surface font-body">
      <nav className="w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="flex justify-between items-center px-6 py-4 max-w-3xl mx-auto">
          <Link href="/" className="text-xl font-bold text-primary tracking-tight font-heading">
            CareerNeeti
          </Link>
          <Link href="/" className="text-sm text-on-surface-variant hover:text-primary transition-colors">
            &larr; Back to site
          </Link>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-heading text-4xl font-bold text-primary mb-2">{title}</h1>
        <p className="text-sm text-on-surface-variant mb-12">Last updated: {lastUpdated}</p>
        <div className="legal-prose space-y-6 text-on-surface-variant leading-relaxed">
          {children}
        </div>
      </main>

      <footer className="w-full py-8 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 max-w-3xl mx-auto gap-4">
          <span className="text-sm font-bold text-primary font-heading">CareerNeeti</span>
          <div className="flex gap-6">
            <Link className="text-xs text-slate-500 hover:text-secondary transition-colors" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="text-xs text-slate-500 hover:text-secondary transition-colors" href="/terms">
              Terms of Service
            </Link>
            <Link className="text-xs text-slate-500 hover:text-secondary transition-colors" href="/contact">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Section heading used across the legal pages. */
export function LegalHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-xl font-bold text-primary pt-6">{children}</h2>
  );
}
