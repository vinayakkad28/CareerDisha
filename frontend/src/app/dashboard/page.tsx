"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dashboard } from "@/lib/api";

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

  useEffect(() => {
    dashboard.stats().then(setStats).catch(console.error);
    dashboard.recent(5).then(setRecentSessions).catch(console.error);
  }, []);

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
