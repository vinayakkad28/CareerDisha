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

interface Props {
  currentStatus: string;
}

export default function SessionTimeline({ currentStatus }: Props) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center gap-0 overflow-x-auto py-4">
      {STEPS.map((step, i) => {
        const isDone = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center min-w-[70px]">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  isDone
                    ? "bg-primary border-primary text-white"
                    : "bg-white border-gray-300 text-gray-400"
                } ${isCurrent ? "ring-2 ring-primary/30 ring-offset-2" : ""}`}
              >
                {isDone ? "\u2713" : i + 1}
              </div>
              <span
                className={`text-xs mt-1 text-center ${
                  isDone ? "text-primary font-medium" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-6 ${
                  i < currentIdx ? "bg-primary" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
