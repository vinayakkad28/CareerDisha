"use client";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  // Session statuses
  draft: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
  scored: { bg: "bg-blue-50", text: "text-blue-700", label: "Scored" },
  generating: { bg: "bg-amber-50", text: "text-amber-700", label: "Generating..." },
  generated: { bg: "bg-purple-50", text: "text-purple-700", label: "Generated" },
  qa_review: { bg: "bg-orange-50", text: "text-orange-700", label: "QA Review" },
  pdf_ready: { bg: "bg-teal-50", text: "text-teal-700", label: "PDFs Ready" },
  delivered: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Delivered" },
  // Student report statuses
  pending: { bg: "bg-gray-100", text: "text-gray-500", label: "Pending" },
  report_generated: { bg: "bg-purple-50", text: "text-purple-700", label: "Report Generated" },
  qa_passed: { bg: "bg-green-50", text: "text-green-700", label: "QA Passed" },
  qa_flagged: { bg: "bg-amber-50", text: "text-amber-700", label: "QA Flagged" },
  // Delivery statuses
  sent: { bg: "bg-blue-50", text: "text-blue-700", label: "Sent" },
  failed: { bg: "bg-red-50", text: "text-red-700", label: "Failed" },
  // Consent
  consented: { bg: "bg-green-50", text: "text-green-700", label: "Consented" },
};

interface Props {
  status: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: Props) {
  const style = STATUS_STYLES[status] || { bg: "bg-gray-100", text: "text-gray-600", label: status };
  const sizeClass = size === "sm" ? "text-xs px-2.5 py-0.5" : "text-sm px-3 py-1";

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${style.bg} ${style.text} ${sizeClass}`}>
      {style.label}
    </span>
  );
}
