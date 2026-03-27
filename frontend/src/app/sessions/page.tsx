"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sessions as sessionsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
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
    <div className="max-w-admin mx-auto">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#1A5276] font-heading tracking-tight">Sessions</h1>
          {sessionList.length > 0 && (
            <p className="text-slate-500 mt-1 font-medium">
              {sessionList.length} session{sessionList.length !== 1 ? "s" : ""} in progress
            </p>
          )}
        </div>
        <Link
          href="/sessions/new"
          className="bg-brand-gradient text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Session</span>
        </Link>
      </div>

      {sessionList.length === 0 ? (
        <div className="bg-[#F0F2F5]/50 border-2 border-dashed border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-[#1A5276] mb-2">No upcoming sessions?</h3>
          <p className="text-slate-500 mb-8 max-w-xs mx-auto">
            Create a session to start assessing students and generating career insights.
          </p>
          <button
            onClick={() => router.push("/sessions/new")}
            className="bg-[#D4AC0D] hover:bg-[#B8960B] text-white px-8 py-3 rounded-lg font-bold transition-all shadow-md flex items-center gap-2 mx-auto active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Create a Session</span>
          </button>
        </div>
      ) : (
        <>
          {/* Data Table Card */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F0F2F5] text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="px-6 py-4">School</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Classes</th>
                    <th className="px-6 py-4">Students</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0">
                  {sessionList.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/sessions/${s.id}`)}
                      className="group hover:bg-[#F0F2F5] transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-5">
                        <div className="font-bold text-[#1A5276]">{s.school_name}</div>
                        {s.school_city && (
                          <div className="text-xs text-slate-400">{s.school_city}</div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">{s.session_date}</td>
                      <td className="px-6 py-5">
                        <div className="flex gap-2 flex-wrap">
                          {(s.classes_assessed || []).map((cls: string | number) => (
                            <span
                              key={cls}
                              className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold rounded uppercase"
                            >
                              Class {cls}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-medium">{s.total_students}</td>
                      <td className="px-6 py-5">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-6 py-5 text-right">
                        <svg className="w-5 h-5 inline-block text-slate-300 group-hover:text-[#1A5276] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards (visible on small screens) */}
          <div className="sm:hidden divide-y divide-surface-container-high bg-white rounded-xl shadow-sm overflow-hidden">
            {sessionList.map((s) => (
              <Link
                key={`mobile-${s.id}`}
                href={`/sessions/${s.id}`}
                className="block px-4 py-4 hover:bg-[#F0F2F5] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#1A5276] truncate">{s.school_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
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
                        className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold rounded uppercase"
                      >
                        Class {cls}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
