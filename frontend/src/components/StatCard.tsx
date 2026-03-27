"use client";

interface Props {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: "blue" | "green" | "purple" | "amber" | "teal" | "gray";
  subtitle?: string;
}

const ICON_BG: Record<string, string> = {
  blue: "bg-primary-100 text-primary",
  green: "bg-accent-100 text-accent-600",
  purple: "bg-purple-100 text-purple-600",
  amber: "bg-amber-100 text-amber-600",
  teal: "bg-teal-100 text-teal-600",
  gray: "bg-gray-100 text-gray-500",
};

const ACCENT_BAR: Record<string, string> = {
  blue: "bg-primary",
  green: "bg-accent",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  gray: "bg-gray-300",
};

export default function StatCard({ label, value, icon, accent = "blue", subtitle }: Props) {
  return (
    <div className="sa-card relative overflow-hidden">
      {/* Subtle left accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${ACCENT_BAR[accent]}`} />
      <div className="flex items-start justify-between pl-3">
        <div>
          <p className="text-sm font-medium text-on-surface-variant">{label}</p>
          <p className="text-2xl font-heading font-bold text-on-surface mt-1">{value}</p>
          {subtitle && <p className="text-xs text-on-surface-variant/60 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ICON_BG[accent]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
