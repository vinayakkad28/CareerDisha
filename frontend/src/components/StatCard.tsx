"use client";

interface Props {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: "blue" | "green" | "purple" | "amber" | "teal" | "gray";
  subtitle?: string;
}

const ICON_BG: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  purple: "bg-purple-50 text-purple-600",
  amber: "bg-amber-50 text-amber-600",
  teal: "bg-teal-50 text-teal-600",
  gray: "bg-gray-100 text-gray-500",
};


export default function StatCard({ label, value, icon, accent = "blue", subtitle }: Props) {
  return (
    <div className="bg-white p-6 rounded-lg flex items-center gap-4">
      {icon && (
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${ICON_BG[accent]}`}>
          {icon}
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-extrabold text-primary font-heading">{value}</p>
        {subtitle && <p className="text-xs text-on-surface-variant/60 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
