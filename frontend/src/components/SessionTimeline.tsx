"use client";

const STEPS = [
  { key: "draft", label: "Draft" },
  { key: "scored", label: "Scored" },
  { key: "generating", label: "Generating" },
  { key: "generated", label: "Generated" },
  { key: "qa_review", label: "QA Review" },
  { key: "pdf_ready", label: "PDFs Ready" },
  { key: "delivered", label: "Delivered" },
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
    <div>
      <div className="flex items-center gap-0 overflow-x-auto py-4">
        {STEPS.map((step, i) => {
          const isDone = i <= currentIdx;
          const isCurrent = i === currentIdx;
          const stepProgress = isCurrent || isDone ? getStepProgress(step.key, stats) : null;

          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center min-w-[80px]">
                {/* Circle */}
                <div className="relative">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      isDone
                        ? "bg-primary border-primary text-white"
                        : "bg-white border-gray-300 text-gray-400"
                    } ${isCurrent ? "ring-2 ring-primary/30 ring-offset-2" : ""}`}
                  >
                    {isDone ? "\u2713" : i + 1}
                  </div>
                  {/* Pulsing dot for active step */}
                  {isCurrent && isActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                    </span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-xs mt-1.5 text-center font-medium ${
                    isDone ? "text-primary" : "text-gray-400"
                  } ${isCurrent && isActive ? "text-amber-600" : ""}`}
                >
                  {step.label}
                </span>
                {/* Progress count */}
                {stepProgress && (
                  <span className={`text-[10px] mt-0.5 ${
                    isCurrent && isActive ? "text-amber-500 font-semibold" : "text-gray-400"
                  }`}>
                    {stepProgress}
                  </span>
                )}
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-8 transition-colors ${
                    i < currentIdx ? "bg-primary" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Overall progress bar */}
      {stats && stats.total > 0 && (
        <div className="mt-1 px-2">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isActive ? "bg-amber-400" : "bg-primary"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-right">{progress}% complete</p>
        </div>
      )}
    </div>
  );
}
