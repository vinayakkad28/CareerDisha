"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { dashboard } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";

const STATUS_COLORS = ["#1a5276", "#2ecc71", "#d4ac0d", "#e74c3c", "#95a5a6"];

interface Stats {
  total_schools: number;
  total_sessions: number;
  total_students: number;
  reports_generated: number;
  pdfs_ready: number;
  delivered: number;
  total_cost_usd: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, sessionsData] = await Promise.all([
        dashboard.stats(),
        dashboard.recent(5),
      ]);
      setStats(statsData);
      setRecentSessions(sessionsData);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statCards = stats
    ? [
        { label: "Schools", value: stats.total_schools, color: "bg-primary" },
        { label: "Sessions", value: stats.total_sessions, color: "bg-primary-500" },
        { label: "Students", value: stats.total_students, color: "bg-accent" },
        { label: "Reports", value: stats.reports_generated, color: "bg-secondary" },
        { label: "PDFs Ready", value: stats.pdfs_ready, color: "bg-accent-600" },
        { label: "Delivered", value: stats.delivered, color: "bg-green-600" },
      ]
    : [];

  const statusColors: Record<string, string> = {
    draft: "bg-gray-200 text-gray-700",
    scored: "bg-blue-100 text-blue-700",
    generating: "bg-yellow-100 text-yellow-700",
    generated: "bg-purple-100 text-purple-700",
    qa_review: "bg-orange-100 text-orange-700",
    pdf_ready: "bg-green-100 text-green-700",
    delivered: "bg-green-200 text-green-800",
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <Link
            href="/sessions/new"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            + New Session
          </Link>
        </div>
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <Link
            href="/sessions/new"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            + New Session
          </Link>
        </div>
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
        <Link
          href="/sessions/new"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          + New Session
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Student Status Distribution */}
      {stats && (() => {
        const pieData = [
          { name: "Reports Generated", value: stats.reports_generated || 0 },
          { name: "PDFs Ready", value: stats.pdfs_ready || 0 },
          { name: "Delivered", value: stats.delivered || 0 },
          { name: "Pending", value: Math.max(0, (stats.total_students || 0) - (stats.reports_generated || 0)) },
        ].filter(d => d.value > 0);

        return pieData.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Status Distribution</h2>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Students"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 min-w-[160px]">
                {pieData.map((d, idx) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[idx % STATUS_COLORS.length] }}
                    />
                    <span className="text-gray-600">{d.name}</span>
                    <span className="font-semibold ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null;
      })()}

      {/* LLM Cost */}
      {stats && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-8 inline-block">
          <p className="text-sm text-gray-500">Total LLM Cost</p>
          <p className="text-xl font-bold text-gray-900">
            ${stats.total_cost_usd.toFixed(4)}
          </p>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Sessions
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentSessions.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400">
              No sessions yet.{" "}
              <Link href="/sessions/new" className="text-primary underline">
                Create your first session
              </Link>
            </div>
          ) : (
            recentSessions.map((s) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{s.school_name}</p>
                  <p className="text-sm text-gray-500">
                    {s.school_city} &middot; {s.session_date} &middot; Classes{" "}
                    {(s.classes_assessed || []).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {s.total_students} students
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      statusColors[s.status] || "bg-gray-100"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
