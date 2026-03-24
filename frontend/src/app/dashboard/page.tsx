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
        <Link
          href="/sessions/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-semibold shadow-sm"
        >
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Schools"
            value={stats.total_schools}
            icon="🏫"
            accent="primary"
          />
          <StatCard
            label="Total Students"
            value={stats.total_students}
            icon="👨‍🎓"
            accent="secondary"
          />
          <StatCard
            label="Reports Generated"
            value={stats.reports_generated}
            icon="📄"
            accent="accent"
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              Student Status Distribution
            </h2>
          </div>
          <div className="p-6">
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
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
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
                    <span className="text-gray-600 flex-1">{d.name}</span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
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
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    School
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentSessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/sessions/${s.id}`)}
                    className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 text-sm">
                        {s.school_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.school_city}
                        {s.classes_assessed?.length > 0 &&
                          ` · Classes ${s.classes_assessed.join(", ")}`}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {s.session_date}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium text-right tabular-nums">
                      {s.total_students}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right tabular-nums">
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
