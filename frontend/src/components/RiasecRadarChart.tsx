"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

const TYPE_NAMES: Record<string, string> = {
  R: "Realistic", I: "Investigative", A: "Artistic",
  S: "Social", E: "Enterprising", C: "Conventional",
};

const TYPE_COLORS: Record<string, string> = {
  R: "#e74c3c", I: "#3498db", A: "#9b59b6",
  S: "#2ecc71", E: "#e67e22", C: "#1abc9c",
};

interface Props {
  scores: Record<string, number>;
  size?: number;
}

export default function RiasecRadarChart({ scores, size = 300 }: Props) {
  const data = Object.entries(TYPE_NAMES).map(([key, name]) => ({
    type: name,
    code: key,
    score: scores[key] || 0,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={data}>
        <PolarGrid stroke="#c1c7cf" strokeOpacity={0.5} />
        <PolarAngleAxis
          dataKey="type"
          tick={{ fontSize: 11, fill: "#41474e", fontFamily: "var(--font-public-sans)" }}
        />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#72787f" }} />
        <Tooltip
          formatter={(value) => [`${value}%`, "Score"]}
          contentStyle={{
            background: "#fff",
            border: "none",
            borderRadius: "4px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            fontSize: "12px",
          }}
        />
        <Radar
          name="RIASEC"
          dataKey="score"
          stroke="#1a5276"
          fill="#1a5276"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* Horizontal bar chart helper for RIASEC scores */
export function RiasecBarChart({ scores }: { scores: Record<string, number> }) {
  const maxScore = Math.max(...Object.values(scores), 1);

  return (
    <div className="space-y-3">
      {Object.entries(TYPE_NAMES).map(([key, name]) => {
        const score = scores[key] || 0;
        const pct = Math.round((score / maxScore) * 100);
        return (
          <div key={key} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: TYPE_COLORS[key] }}
            >
              {key}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-on-surface">{name}</span>
                <span className="text-sm font-heading font-bold text-on-surface">{score}%</span>
              </div>
              <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: TYPE_COLORS[key] }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
