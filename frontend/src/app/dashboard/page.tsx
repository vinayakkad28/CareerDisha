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
        <Link href="/sessions/new" className="btn-primary">
          <span className="text-lg leading-none">+</span>
          New Session
        </Link>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            label="Total Schools"
            value={stats.total_schools}
            icon="🏫"
            accent="blue"
          />
          <StatCard
            label="Total Students"
            value={stats.total_students}
            icon="👨‍🎓"
            accent="green"
          />
          <StatCard
            label="Reports Generated"
            value={stats.reports_generated}
            icon="📄"
            accent="purple"
          />
          <StatCard
            label="Total Cost"
            value={`$${stats.total_cost_usd.toFixed(2)}`}
            icon="💰"
            accent="gray"
          />
        </div>
      )}

      {/* Student Status Distribution */}
      {pieData.length > 0 && (
        <div className="sa-card">
          <h2 className="text-lg font-heading font-semibold text-on-surface mb-5">
            Student Status Distribution
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-2/3">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
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
                      borderRadius: "4px",
                      border: "none",
                      background: "#ffffff",
                      boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3 min-w-[180px]">
              {pieData.map((d, idx) => (
                <div key={d.name} className="flex items-center gap-3 text-sm">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        STATUS_COLORS[idx % STATUS_COLORS.length],
                    }}
                  />
                  <span className="text-on-surface-variant flex-1">{d.name}</span>
                  <span className="font-semibold text-on-surface tabular-nums">
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="sa-card !p-0">
        <div className="px-6 py-5 flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-on-surface">
            Recent Sessions
          </h2>
          <Link
            href="/sessions"
            className="text-sm text-primary hover:text-primary-700 font-medium transition-colors"
          >
            View all
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
          <div className="overflow-x-auto">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Date</th>
                  <th className="text-right">Students</th>
                  <th>Status</th>
                  <th className="text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/sessions/${s.id}`)}
                    className="cursor-pointer"
                  >
                    <td>
                      <p className="font-medium text-on-surface text-sm">
                        {s.school_name}
                      </p>
                      <p className="text-xs text-on-surface-variant/60 mt-0.5">
                        {s.school_city}
                        {s.classes_assessed?.length > 0 &&
                          ` · Classes ${s.classes_assessed.join(", ")}`}
                      </p>
                    </td>
                    <td className="text-sm text-on-surface-variant">
                      {s.session_date}
                    </td>
                    <td className="text-sm text-on-surface font-medium text-right tabular-nums">
                      {s.total_students}
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="text-sm text-on-surface-variant text-right tabular-nums">
                      {s.total_cost != null
                        ? `$${Number(s.total_cost).toFixed(2)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
