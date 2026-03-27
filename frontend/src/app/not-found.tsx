import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden bg-surface font-body relative">
      {/* Top Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" className="text-2xl font-bold text-primary tracking-tight font-heading">
            CareerDisha
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <span className="text-slate-400 text-sm uppercase tracking-widest">Error 404</span>
          </div>
        </div>
      </nav>

      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
        <h2 className="font-heading font-extrabold text-[20vw] leading-none">CareerDisha</h2>
      </div>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-[720px] px-6 text-center">
        {/* Decorative Huge 404 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10">
          <span className="font-heading font-extrabold text-[180px] md:text-[280px] text-surface-container-highest opacity-40 leading-none tracking-tighter">
            404
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center gap-8 pt-12">
          <div className="space-y-4">
            <h1 className="font-heading font-bold text-4xl md:text-5xl text-primary tracking-tight">
              Page not found
            </h1>
            <p className="text-on-surface-variant text-lg md:text-xl max-w-md mx-auto leading-relaxed">
              The page you are looking for does not exist or has been moved.
            </p>
            {/* Hindi Subtitle */}
            <p className="text-slate-400 text-sm">
              {"\u0915\u094D\u0937\u092E\u093E \u0915\u0930\u0947\u0902, \u092F\u0939 \u092A\u0943\u0937\u094D\u0920 \u0909\u092A\u0932\u092C\u094D\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964"}
            </p>
          </div>

          {/* CTA Cluster */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4">
            <Link
              href="/"
              className="bg-brand-gradient text-white px-8 py-3.5 rounded-lg font-heading font-semibold text-sm tracking-wide shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Go Home
            </Link>
            <Link
              href="/assessment"
              className="border-2 border-primary text-primary px-8 py-3 rounded-lg font-heading font-semibold text-sm tracking-wide hover:bg-surface-container transition-all active:scale-95 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Assessment
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-12 w-full text-center pointer-events-none">
        <p className="text-outline-variant text-xs tracking-widest uppercase">
          CareerDisha Intellectual Property. Scholarly Architect Series.
        </p>
      </footer>
    </div>
  );
}
