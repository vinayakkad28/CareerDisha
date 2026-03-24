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
    <div>
      <PageHeader
        title="Sessions"
        subtitle={sessionList.length > 0 ? `${sessionList.length} session${sessionList.length !== 1 ? "s" : ""}` : undefined}
        actions={
          <Link
            href="/sessions/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
          >
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="col-span-4 text-xs font-medium text-gray-500 uppercase tracking-wider">School</div>
            <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</div>
            <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Classes</div>
            <div className="col-span-1 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Students</div>
            <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Status</div>
            <div className="col-span-1 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Actions</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {sessionList.map((s) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="block sm:grid sm:grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors group"
              >
                {/* School */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 group-hover:text-primary transition-colors truncate">
                      {s.school_name}
                    </p>
                    <p className="text-xs text-gray-400 sm:hidden mt-0.5">
                      {s.session_date} -- {s.total_students} students
                    </p>
                    {s.school_city && (
                      <p className="text-xs text-gray-400 hidden sm:block">{s.school_city}</p>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div className="hidden sm:flex col-span-2 items-center">
                  <span className="text-sm text-gray-600">{s.session_date}</span>
                </div>

                {/* Classes */}
                <div className="hidden sm:flex col-span-2 items-center gap-1 flex-wrap">
                  {(s.classes_assessed || []).map((cls: string | number) => (
                    <span
                      key={cls}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                    >
                      {cls}
                    </span>
                  ))}
                </div>

                {/* Students */}
                <div className="hidden sm:flex col-span-1 items-center justify-end">
                  <span className="text-sm font-medium text-gray-900">{s.total_students}</span>
                </div>

                {/* Status */}
                <div className="hidden sm:flex col-span-2 items-center justify-center">
                  <StatusBadge status={s.status} />
                </div>

                {/* Actions */}
                <div className="hidden sm:flex col-span-1 items-center justify-end">
                  <span className="text-gray-300 group-hover:text-primary transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>

                {/* Mobile status row */}
                <div className="flex items-center justify-between mt-2 sm:hidden">
                  <StatusBadge status={s.status} />
                  <div className="flex items-center gap-1 flex-wrap">
                    {(s.classes_assessed || []).map((cls: string | number) => (
                      <span
                        key={cls}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
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
