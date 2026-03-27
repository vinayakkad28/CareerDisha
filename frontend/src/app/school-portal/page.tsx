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
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

const STREAM_COLORS: Record<string, string> = {
  "Science (PCM)": "#2980b9",
  "Science (PCB)": "#27ae60",
  "Commerce": "#e67e22",
  "Arts/Humanities": "#8e44ad",
  "Undecided": "#95a5a6",
};

const RIASEC_COLORS: Record<string, string> = {
  R: "#e74c3c", I: "#3498db", A: "#9b59b6",
  S: "#2ecc71", E: "#e67e22", C: "#1abc9c",
};

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

  if (loading) return <LoadingSpinner message="Loading school data\u2026" />;
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
      <PageHeader
        title={school.name}
        subtitle={`${school.city} \u00b7 ${school.board} \u00b7 Code: ${school.code}`}
        actions={
          <button onClick={downloadCsv} className="btn-gold">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="sa-card">
          <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-1">Total Sessions</p>
          <p className="text-3xl font-heading font-bold text-on-surface">{school.total_sessions}</p>
        </div>
        <div className="sa-card">
          <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-1">Students Assessed</p>
          <p className="text-3xl font-heading font-bold text-on-surface">{school.total_students}</p>
        </div>
        <div className="sa-card">
          <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-1">Reports Delivered</p>
          <p className="text-3xl font-heading font-bold text-on-surface">{school.total_delivered}</p>
        </div>
        {hasAnalytics && (
          <div className="sa-card">
            <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-1">Consent Rate</p>
            <p className="text-3xl font-heading font-bold text-on-surface">{analytics.consent_rate}%</p>
            <p className="text-xs text-on-surface-variant/50 mt-1">DPDPA compliant</p>
          </div>
        )}
      </div>

      {hasAnalytics && analytics.feedback_responses > 0 && (
        <div className="grid grid-cols-3 gap-5">
          <div className="sa-card">
            <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-1">NPS Score</p>
            <p className="text-3xl font-heading font-bold text-on-surface">{analytics.nps !== null ? analytics.nps : "\u2014"}</p>
            <p className="text-xs text-on-surface-variant/50 mt-1">Would recommend CareerDisha</p>
          </div>
          <div className="sa-card">
            <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-1">Avg Rating</p>
            <p className="text-3xl font-heading font-bold text-on-surface">{analytics.avg_rating !== null ? `${analytics.avg_rating} / 5` : "\u2014"}</p>
            <p className="text-xs text-on-surface-variant/50 mt-1">Parent satisfaction</p>
          </div>
          <div className="sa-card">
            <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-1">Feedback Responses</p>
            <p className="text-3xl font-heading font-bold text-on-surface">{analytics.feedback_responses}</p>
            <p className="text-xs text-on-surface-variant/50 mt-1">Surveys completed</p>
          </div>
        </div>
      )}

      {hasAnalytics && (
        <>
          {/* RIASEC Average + Bar Chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* RIASEC Radar */}
            <div className="sa-card">
              <h2 className="text-base font-heading font-semibold text-on-surface mb-4">Average RIASEC Profile (School)</h2>
              <RiasecRadarChart scores={analytics.riasec_averages} size={280} />
            </div>

            {/* RIASEC Bar */}
            <div className="sa-card">
              <h2 className="text-base font-heading font-semibold text-on-surface mb-4">RIASEC Score Breakdown</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={riasecBarData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#41474e" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#72787f" }} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "Avg Score"]}
                    contentStyle={{
                      borderRadius: "4px",
                      border: "none",
                      background: "#ffffff",
                      boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
                      fontSize: "12px",
                    }}
                  />
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
            <div className="sa-card">
              <h2 className="text-base font-heading font-semibold text-on-surface mb-4">Recommended Stream Distribution</h2>
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
                    <Tooltip
                      formatter={(v) => [v as number, "Students"]}
                      contentStyle={{
                        borderRadius: "4px",
                        border: "none",
                        background: "#ffffff",
                        boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-on-surface-variant/50 text-sm">No stream data available yet.</p>
              )}
            </div>

            {/* Top Careers */}
            <div className="sa-card">
              <h2 className="text-base font-heading font-semibold text-on-surface mb-4">Top Career Matches in School</h2>
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
                {(analytics.top_careers as { name: string; count: number }[]).map((c, i) => {
                  const max = analytics.top_careers[0]?.count || 1;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-heading font-bold text-on-surface-variant/40 w-4 text-right">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-sm font-medium text-on-surface">{c.name}</span>
                          <span className="text-xs text-on-surface-variant/50 tabular-nums">{c.count}</span>
                        </div>
                        <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
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
          <div className="sa-card">
            <h2 className="text-base font-heading font-semibold text-on-surface mb-4">Report Completion</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-3 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${analytics.report_completion_rate}%` }}
                />
              </div>
              <span className="text-sm font-heading font-semibold text-on-surface whitespace-nowrap">
                {analytics.report_completion_rate}% complete
              </span>
            </div>
            <p className="text-xs text-on-surface-variant/50 mt-2">
              {analytics.total_students} students assessed across {analytics.total_sessions} sessions
            </p>
          </div>
        </>
      )}

      {/* Sessions List */}
      <div>
        <h2 className="text-base font-heading font-semibold text-on-surface mb-4">Sessions</h2>
        {(school.sessions || []).length === 0 ? (
          <p className="text-on-surface-variant/50 text-sm">No sessions yet.</p>
        ) : (
          <div className="space-y-3">
            {school.sessions.map((s: any) => (
              <div key={s.id} className="sa-card flex justify-between items-center">
                <div>
                  <p className="font-heading font-medium text-on-surface">{s.session_date}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {s.total_students} students \u00b7 Classes {(s.classes_assessed || []).join(", ")} \u00b7{" "}
                    <StatusBadge status={s.status} size="sm" />
                  </p>
                </div>
                <Link
                  href={`/sessions/${s.id}`}
                  className="btn-primary !px-3 !py-1.5 !text-xs"
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
