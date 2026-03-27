"use client";

const STEPS = [
  { key: "draft", label: "Draft", color: "gray" },
  { key: "scored", label: "Scored", color: "blue" },
  { key: "generating", label: "Generating", color: "amber" },
  { key: "generated", label: "Generated", color: "purple" },
  { key: "qa_review", label: "QA Review", color: "orange" },
  { key: "pdf_ready", label: "PDFs Ready", color: "teal" },
  { key: "delivered", label: "Delivered", color: "green" },
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
    <div className="sa-card">
      <div className="flex items-center justify-between overflow-x-auto py-4 px-2">
        {STEPS.map((step, i) => {
          const isDone = i <= currentIdx;
          const isCurrent = i === currentIdx;
          const stepProgress = isCurrent || isDone ? getStepProgress(step.key, stats) : null;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center w-full">
                {/* Circle */}
                <div className="relative">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isDone
                        ? "bg-primary text-white"
                        : "bg-surface-container-high text-on-surface-variant/40"
                    } ${isCurrent ? "ring-3 ring-primary/20 ring-offset-2" : ""}`}
                  >
                    {isDone ? (
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  {isCurrent && isActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                    </span>
                  )}
                </div>
                {/* Label */}
                <span className={`text-xs mt-2 text-center font-medium ${
                  isDone ? "text-primary" : "text-on-surface-variant/40"
                } ${isCurrent && isActive ? "text-amber-600" : ""}`}>
                  {step.label}
                </span>
                {/* Progress count */}
                {stepProgress && (
                  <span className={`text-[10px] mt-0.5 font-mono ${
                    isCurrent && isActive ? "text-amber-500 font-semibold" : "text-on-surface-variant/50"
                  }`}>
                    {stepProgress}
                  </span>
                )}
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-full min-w-[24px] -mt-6 transition-colors ${
                  i < currentIdx ? "bg-primary" : "bg-surface-container-highest"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Overall progress bar */}
      {stats && stats.total > 0 && (
        <div className="mt-2 px-2">
          <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out bg-brand-gradient"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-on-surface-variant/50 mt-1.5 text-right font-medium">
            {progress}% complete
          </p>
        </div>
      )}
    </div>
  );
}
