"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sessions as sessionsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/UIStates";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

export default function SessionsPage() {
  const router = useRouter();
  const [sessionList, setSessionList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sessionsApi
      .list()
      .then(setSessionList)
      .catch((err) => setError(err.message || "Failed to load sessions"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        subtitle={sessionList.length > 0 ? `${sessionList.length} session${sessionList.length !== 1 ? "s" : ""}` : undefined}
        actions={
          <Link href="/sessions/new" className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Session
          </Link>
        }
      />

      {sessionList.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Create a session to start assessing students"
          actionLabel="New Session"
          onAction={() => router.push("/sessions/new")}
        />
      ) : (
        <div className="sa-card !p-0 overflow-hidden">
          <div className="overflow-x-auto hidden sm:block">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Date</th>
                  <th>Classes</th>
                  <th className="text-right">Students</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessionList.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/sessions/${s.id}`)}
                    className="cursor-pointer group"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-on-surface group-hover:text-primary transition-colors truncate">
                            {s.school_name}
                          </p>
                          {s.school_city && (
                            <p className="text-xs text-on-surface-variant/60">{s.school_city}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-on-surface-variant">{s.session_date}</span>
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {(s.classes_assessed || []).map((cls: string | number) => (
                          <span
                            key={cls}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-container-high text-on-surface-variant"
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right">
                      <span className="font-medium text-on-surface tabular-nums">{s.total_students}</span>
                    </td>
                    <td className="text-center">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="text-right">
                      <span className="text-on-surface-variant/30 group-hover:text-primary transition-colors">
                        <svg className="w-5 h-5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards (visible on small screens where table is harder to use) */}
          <div className="sm:hidden divide-y divide-surface-container-high">
            {sessionList.map((s) => (
              <Link
                key={`mobile-${s.id}`}
                href={`/sessions/${s.id}`}
                className="block px-4 py-4 hover:bg-surface transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-on-surface truncate">{s.school_name}</p>
                    <p className="text-xs text-on-surface-variant/60 mt-0.5">
                      {s.session_date} -- {s.total_students} students
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <StatusBadge status={s.status} />
                  <div className="flex items-center gap-1 flex-wrap">
                    {(s.classes_assessed || []).map((cls: string | number) => (
                      <span
                        key={cls}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-container-high text-on-surface-variant"
                      >
                        Class {cls}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
