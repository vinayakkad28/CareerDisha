"use client";

const STEPS = [
  { key: "draft", label: "Draft", icon: "check" },
  { key: "scored", label: "Scored", icon: "check" },
  { key: "generating", label: "Generating", icon: "check" },
  { key: "generated", label: "Generated", icon: "dot" },
  { key: "qa_review", label: "QA Review", icon: "hourglass_empty" },
  { key: "pdf_ready", label: "PDFs Ready", icon: "description" },
  { key: "delivered", label: "Delivered", icon: "local_shipping" },
];

interface Stats {
  total: number;
  scored: number;
  reports_generated: number;
  qa_passed: number;
  qa_flagged: number;
  pdf_ready: number;
  delivered: number;
}

interface Props {
  currentStatus: string;
  stats?: Stats;
}

function getStepProgress(stepKey: string, stats?: Stats): string | null {
  if (!stats || stats.total === 0) return null;
  const t = stats.total;
  switch (stepKey) {
    case "scored": return `${stats.scored}/${t}`;
    case "generating":
    case "generated": return `${stats.reports_generated}/${t}`;
    case "qa_review": {
      if (stats.qa_flagged > 0) return `${stats.qa_passed} ok, ${stats.qa_flagged} flagged`;
      return `${stats.qa_passed}/${t}`;
    }
    case "pdf_ready": return `${stats.pdf_ready}/${t}`;
    case "delivered": return `${stats.delivered}/${t}`;
    default: return null;
  }
}

function getOverallProgress(currentStatus: string, stats?: Stats): number {
  if (!stats || stats.total === 0) return 0;
  const t = stats.total;
  const weights: Record<string, number> = {
    draft: 0,
    scored: 15,
    generating: 15 + 35 * (stats.reports_generated / t),
    generated: 50,
    qa_review: 65,
    pdf_ready: 85,
    delivered: 85 + 15 * (stats.delivered / t),
  };
  return Math.round(weights[currentStatus] ?? 0);
}

export default function SessionTimeline({ currentStatus, stats }: Props) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStatus);
  const progress = getOverallProgress(currentStatus, stats);
  const isActive = currentStatus === "generating";

  return (
    <section className="bg-white p-8 rounded-lg shadow-sm">
      <div className="flex justify-between relative mb-12">
        {/* Progress Line Background */}
        <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-200 -z-10" />
        {/* Completed Progress Line */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-primary -z-10 transition-all duration-500"
          style={{ width: `${currentIdx > 0 ? (currentIdx / (STEPS.length - 1)) * 100 : 0}%` }}
        />

        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture = i > currentIdx;
          const stepProgress = isCurrent || isDone ? getStepProgress(step.key, stats) : null;

          return (
            <div key={step.key} className="flex flex-col items-center gap-3 bg-white px-2">
              {/* Circle */}
              <div className="relative">
                {isDone ? (
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : isCurrent ? (
                  <div className="w-10 h-10 rounded-full bg-white border-2 border-purple-500 ring-4 ring-purple-100 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center">
                    {step.icon === "hourglass_empty" ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z"/></svg>
                    ) : step.icon === "description" ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                    ) : step.icon === "local_shipping" ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                    ) : (
                      <span className="text-sm font-bold">{i + 1}</span>
                    )}
                  </div>
                )}
                {isCurrent && isActive && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                  </span>
                )}
              </div>
              {/* Label */}
              <div className="text-center">
                <p className={`text-xs font-bold ${
                  isDone ? "text-primary" :
                  isCurrent ? "text-purple-700" :
                  "text-slate-400"
                } ${isCurrent && isActive ? "text-amber-600" : ""}`}>
                  {step.label}
                </p>
                {/* Progress count */}
                {stepProgress && (
                  <p className={`text-[10px] mt-0.5 ${
                    isCurrent && isActive ? "text-amber-500 font-semibold" : "text-slate-400"
                  }`}>
                    {stepProgress}
                  </p>
                )}
                {isFuture && stats && stats.total > 0 && (
                  <p className="text-[10px] text-slate-400">0/{stats.total}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall progress bar */}
      {stats && stats.total > 0 && (
        <div className="mt-8 space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Overall Progress</span>
            <span className="text-sm font-bold text-primary">{progress}%</span>
          </div>
          <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-gradient rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
