"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

const TYPE_NAMES: Record<string, string> = {
  R: "Realistic", I: "Investigative", A: "Artistic",
  S: "Social", E: "Enterprising", C: "Conventional",
};

interface Props {
  scores: Record<string, number>;
  size?: number;
}

export default function RiasecRadarChart({ scores, size = 300 }: Props) {
  const data = Object.entries(TYPE_NAMES).map(([key, name]) => ({
    type: `${key}\n${name}`,
    score: scores[key] || 0,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e0e0e0" />
        <PolarAngleAxis dataKey="type" tick={{ fontSize: 11, fill: "#555" }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
        <Tooltip formatter={(value) => [`${value}%`, "Score"]} />
        <Radar
          name="RIASEC"
          dataKey="score"
          stroke="#1a5276"
          fill="#1a5276"
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
