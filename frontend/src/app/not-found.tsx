import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-surface font-body">
      {/* ── Minimal Glassmorphic Navbar ─────────────────────── */}
      <nav className="backdrop-blur-xl bg-primary/80 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/" className="font-heading text-xl font-extrabold tracking-tight">
            <span className="text-white">Career</span>
            <span className="text-secondary">Disha</span>
          </Link>
        </div>
      </nav>

      {/* ── Centered 404 Content ───────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="font-heading text-[120px] sm:text-[160px] font-extrabold leading-none text-surface-container-high select-none">
            404
          </p>
          <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-on-surface -mt-4 mb-3">
            Page not found
          </h2>
          <p className="font-body text-on-surface-variant text-sm mb-10 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/" className="btn-primary px-8 py-3 rounded-lg">
              Go Home
            </Link>
            <Link href="/assessment" className="btn-ghost px-8 py-3 rounded-lg">
              Start Assessment
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
