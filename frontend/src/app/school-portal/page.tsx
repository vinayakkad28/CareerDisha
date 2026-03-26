"use client";

import { useEffect, useState } from "react";
import { schoolPortal } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import RiasecRadarChart from "@/components/RiasecRadarChart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from "recharts";
import Link from "next/link";

const STREAM_COLORS: Record<string, string> = {
  "Science (PCM)": "#2980b9",
  "Science (PCB)": "#27ae60",
  "Commerce": "#e67e22",
  "Arts/Humanities": "#8e44ad",
  "Undecided": "#95a5a6",
};

const RIASEC_COLORS: Record<string, string> = {
  R: "#27ae60", I: "#2980b9", A: "#8e44ad",
  S: "#e67e22", E: "#c0392b", C: "#16a085",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-base font-semibold text-gray-700 mb-3">{title}</h2>;
}

export default function SchoolPortalPage() {
  const [school, setSchool] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([schoolPortal.mySchool(), schoolPortal.analytics()])
      .then(([s, a]) => { setSchool(s); setAnalytics(a); })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const downloadCsv = () => {
    if (!school?.sessions) return;
    const rows: string[][] = [
      ["Session Date", "Classes", "Total Students", "Status", "Counsellor"],
    ];
    for (const s of school.sessions) {
      rows.push([
        s.session_date,
        (s.classes_assessed || []).join(";"),
        String(s.total_students),
        s.status,
        s.counsellor_name || "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${school.name || "school"}_sessions.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <LoadingSpinner message="Loading school data…" />;
  if (error) return <ErrorState message={error} />;
  if (!school) return null;

  const hasAnalytics = analytics && analytics.total_students > 0;

  const streamData = hasAnalytics
    ? Object.entries(analytics.stream_distribution as Record<string, number>).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const riasecBarData = hasAnalytics
    ? Object.entries(analytics.riasec_averages as Record<string, number>).map(([key, score]) => ({
        name: key,
        score,
        fill: RIASEC_COLORS[key] || "#888",
      }))
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-primary">{school.name}</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {school.city} · {school.board} · Code: {school.code}
          </p>
        </div>
        <button
          onClick={downloadCsv}
          className="text-sm bg-secondary text-white px-4 py-2 rounded-lg hover:bg-secondary/90"
        >
          Export CSV
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Sessions" value={school.total_sessions} />
        <StatCard label="Students Assessed" value={school.total_students} />
        <StatCard label="Reports Delivered" value={school.total_delivered} />
        {hasAnalytics && (
          <>
            <StatCard
              label="Consent Rate"
              value={`${analytics.consent_rate}%`}
              sub="DPDPA compliant"
            />
          </>
        )}
      </div>

      {hasAnalytics && analytics.feedback_responses > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="NPS Score"
            value={analytics.nps !== null ? analytics.nps : "—"}
            sub="Would recommend CareerDisha"
          />
          <StatCard
            label="Avg Rating"
            value={analytics.avg_rating !== null ? `${analytics.avg_rating} / 5` : "—"}
            sub="Parent satisfaction"
          />
          <StatCard
            label="Feedback Responses"
            value={analytics.feedback_responses}
            sub="Surveys completed"
          />
        </div>
      )}

      {hasAnalytics && (
        <>
          {/* RIASEC Average + Stream Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* RIASEC Radar */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <SectionHeader title="Average RIASEC Profile (School)" />
              <RiasecRadarChart scores={analytics.riasec_averages} size={280} />
            </div>

            {/* RIASEC Bar */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <SectionHeader title="RIASEC Score Breakdown" />
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={riasecBarData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`, "Avg Score"]} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {riasecBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stream Distribution + Top Careers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stream Pie */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <SectionHeader title="Recommended Stream Distribution" />
              {streamData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={streamData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) =>
                        `${(name as string).split(" ")[0]} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {streamData.map((entry, i) => (
                        <Cell key={i} fill={STREAM_COLORS[entry.name] || "#bdc3c7"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [v as number, "Students"]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-sm">No stream data available yet.</p>
              )}
            </div>

            {/* Top Careers */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <SectionHeader title="Top Career Matches in School" />
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {(analytics.top_careers as { name: string; count: number }[]).map((c, i) => {
                  const max = analytics.top_careers[0]?.count || 1;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-sm font-medium text-gray-700">{c.name}</span>
                          <span className="text-xs text-gray-400">{c.count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(c.count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Completion Stats */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <SectionHeader title="Report Completion" />
            <div className="flex items-center gap-4">
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${analytics.report_completion_rate}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                {analytics.report_completion_rate}% complete
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {analytics.total_students} students assessed across {analytics.total_sessions} sessions
            </p>
          </div>
        </>
      )}

      {/* Sessions List */}
      <div>
        <SectionHeader title="Sessions" />
        {(school.sessions || []).length === 0 ? (
          <p className="text-gray-400 text-sm">No sessions yet.</p>
        ) : (
          <div className="space-y-3">
            {school.sessions.map((s: any) => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm p-5 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-800">{s.session_date}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.total_students} students · Classes {(s.classes_assessed || []).join(", ")} ·{" "}
                    <span
                      className={`font-medium ${
                        s.status === "delivered"
                          ? "text-green-600"
                          : s.status === "draft"
                          ? "text-gray-400"
                          : "text-orange-500"
                      }`}
                    >
                      {s.status}
                    </span>
                  </p>
                </div>
                <Link
                  href={`/sessions/${s.id}`}
                  className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
