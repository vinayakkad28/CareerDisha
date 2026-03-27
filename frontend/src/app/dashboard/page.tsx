"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { dashboard } from "@/lib/api";
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/UIStates";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";

const STATUS_COLORS = ["#a855f7", "#3b82f6", "#22c55e", "#94a3b8"];

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
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

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

  const header = (
    <PageHeader
      title="Dashboard"
      subtitle="Overview of your career counselling sessions"
      actions={
        <>
          <div className="relative group">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary w-64 text-sm font-body"
            />
          </div>
          <Link href="/sessions/new" className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-primary-700 transition-all shadow-lg shadow-primary/20 text-sm">
            <span className="text-lg leading-none">+</span>
            New Session
          </Link>
        </>
      }
    />
  );

  if (loading) {
    return (
      <div>
        {header}
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {header}
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    );
  }

  const pieData = stats
    ? [
        { name: "Reports Generated", value: stats.reports_generated || 0 },
        { name: "PDFs Ready", value: stats.pdfs_ready || 0 },
        { name: "Delivered", value: stats.delivered || 0 },
        {
          name: "Pending",
          value: Math.max(
            0,
            (stats.total_students || 0) - (stats.reports_generated || 0)
          ),
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-8">
      {header}

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Schools"
            value={stats.total_schools}
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
              </svg>
            }
            accent="blue"
            subtitle="Registered Schools"
          />
          <StatCard
            label="Total Students"
            value={stats.total_students}
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            }
            accent="green"
            subtitle="Assessed Students"
          />
          <StatCard
            label="Reports Generated"
            value={stats.reports_generated}
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
            }
            accent="purple"
            subtitle={`${stats.total_students > 0 ? Math.round((stats.reports_generated / stats.total_students) * 100) : 0}% Completion`}
          />
          <StatCard
            label="Total Cost"
            value={`\u20B9${stats.total_cost_usd.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-2 0H3V6h14v8zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm13 0v11c0 1.1-.9 2-2 2H4v-2h17V7h2z"/>
              </svg>
            }
            accent="amber"
            subtitle="API & Compute Costs"
          />
        </div>
      )}

      {/* Dashboard Grid: Distribution + Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* LEFT: Student Status Distribution (Donut Chart) */}
        {pieData.length > 0 && (
          <div className="lg:col-span-3 bg-white p-8 rounded-xl">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-xl font-heading font-extrabold text-primary">Student Status Distribution</h4>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-around gap-12">
              {/* Donut Chart with center total */}
              <div className="relative w-56 h-56 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {pieData.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={STATUS_COLORS[idx % STATUS_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [value, "Students"]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        background: "#ffffff",
                        boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center total */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-4xl font-heading font-extrabold text-primary leading-none">
                    {stats?.total_students || 0}
                  </span>
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-1">Total</span>
                </div>
              </div>
              {/* Legend */}
              <div className="space-y-5 w-full md:w-auto">
                {pieData.map((d, idx) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          STATUS_COLORS[idx % STATUS_COLORS.length],
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface-variant uppercase">{d.name}</span>
                      <span className="text-lg font-bold text-on-surface leading-none">{d.value} students</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT: Recent Sessions */}
        <div className="lg:col-span-2 bg-white p-8 rounded-xl flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-xl font-heading font-extrabold text-primary">Recent Sessions</h4>
            <Link
              href="/sessions"
              className="text-sm font-bold text-primary flex items-center gap-1 hover:underline"
            >
              View all
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              description="Create your first career counselling session to get started."
              actionLabel="Create Session"
              onAction={() => router.push("/sessions/new")}
            />
          ) : (
            <div className="flex-1 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface-container-high">
                  <tr>
                    <th className="py-3 px-4 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest rounded-l-lg">School</th>
                    <th className="py-3 px-4 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest text-center">Count</th>
                    <th className="py-3 px-4 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest text-right rounded-r-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {recentSessions.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/sessions/${s.id}`)}
                      className="cursor-pointer group hover:bg-surface transition-colors"
                    >
                      <td className="py-4 px-4">
                        <p className="text-sm font-bold text-on-surface">{s.school_name}</p>
                        <p className="text-[11px] text-on-surface-variant">{s.session_date}</p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm font-medium text-on-surface-variant">{s.total_students}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bento: AI Updates + Support */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* AI Updates Card */}
        <div className="md:col-span-2 bg-gradient-to-br from-primary to-primary-800 p-8 rounded-xl text-white flex justify-between items-center relative overflow-hidden">
          <div className="relative z-10">
            <h5 className="text-2xl font-heading font-extrabold mb-2">New Career Paths Added</h5>
            <p className="text-primary-200 max-w-md mb-6 opacity-90">
              Our AI has just been updated with 15 new sustainable energy career tracks for the upcoming academic year assessments.
            </p>
            <button className="bg-secondary text-primary-900 px-6 py-2 rounded-lg font-bold hover:bg-secondary-300 transition-all text-sm">
              View Details
            </button>
          </div>
          <div className="relative h-full w-1/3 opacity-20 flex items-center justify-end">
            <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/>
            </svg>
          </div>
        </div>

        {/* Support Card */}
        <div className="bg-white p-8 rounded-xl flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center text-secondary mb-4">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 12.22C21 6.73 16.74 3 12 3c-4.69 0-9 3.65-9 9.28-.6.34-1 .98-1 1.72v2c0 1.1.9 2 2 2h1v-6.1c0-3.87 3.13-7 7-7s7 3.13 7 7V19h-8v2h8c1.1 0 2-.9 2-2v-1.22c.59-.31 1-.92 1-1.64v-2.3c0-.7-.41-1.31-1-1.62z"/>
              <circle cx="9" cy="13" r="1"/>
              <circle cx="15" cy="13" r="1"/>
              <path d="M18 11.03C17.52 8.18 15.04 6 12.05 6c-3.03 0-6.29 2.51-6.03 6.45 2.47-1.01 4.33-3.21 4.86-5.89 1.31 2.63 4 4.44 7.12 4.47z"/>
            </svg>
          </div>
          <h5 className="text-lg font-heading font-extrabold text-primary mb-2">Need Assistance?</h5>
          <p className="text-sm text-on-surface-variant mb-6">Our dedicated support team is available for administrative queries.</p>
          <button className="w-full py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold rounded-lg transition-colors text-sm">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
