"use client";

interface Props {
  label: string;
  value: string | number;
  icon?: string;
  accent?: "primary" | "secondary" | "accent" | "gray";
  subtitle?: string;
}

const ACCENT_STYLES = {
  primary: "border-l-primary bg-primary/5",
  secondary: "border-l-secondary bg-secondary/5",
  accent: "border-l-accent bg-accent/5",
  gray: "border-l-gray-300 bg-gray-50",
};

export default function StatCard({ label, value, icon, accent = "primary", subtitle }: Props) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 ${ACCENT_STYLES[accent]} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {icon && <span className="text-3xl opacity-60">{icon}</span>}
      </div>
    </div>
  );
}
