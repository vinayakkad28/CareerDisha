"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary for shared report links.
 *
 * Without one, any render-time failure — a report row missing an expected field,
 * a malformed LLM payload — produced a completely blank white page for a parent
 * who had followed a link from WhatsApp, with nothing to act on.
 */
export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Report render failed:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface font-body flex items-center justify-center px-4">
      <div className="sa-card max-w-md w-full text-center space-y-4">
        <h1 className="font-heading text-xl font-bold text-primary">
          We could not display this report
        </h1>
        <p className="text-on-surface-variant text-sm">
          Something went wrong while loading it. Your report is safe — this is a
          display problem on our side.
        </p>
        <button
          onClick={reset}
          className="btn-primary w-full py-3 font-heading font-bold text-sm"
        >
          Try again
        </button>
        <p className="text-xs text-on-surface-variant">
          If it keeps happening, contact your school counsellor and
          we will send the PDF directly.
        </p>
      </div>
    </div>
  );
}
