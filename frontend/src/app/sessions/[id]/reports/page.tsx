"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { reports as reportsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import { useToast } from "@/components/Toast";

export default function QAReportsPage() {
  const params = useParams();
  const [qaReport, setQaReport] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadQA = () => {
    setFetchError(null);
    reportsApi
      .qaReport(Number(params.id))
      .then(setQaReport)
      .catch((err: any) => setFetchError(err.message || "Failed to load QA report"));
  };

  useEffect(() => {
    loadQA();
  }, [params.id]);

  const handleApproveAll = async () => {
    if (!qaReport) return;
    try {
      const ids = qaReport.flagged_details.map((f: any) => f.student_id);
      await reportsApi.qaApprove(Number(params.id), ids);
      toast("All flagged reports approved", "success");
      loadQA();
    } catch (err: any) {
      toast(err.message || "Approval failed", "error");
    }
  };

  const handleApproveOne = async (studentId: number) => {
    try {
      await reportsApi.qaApprove(Number(params.id), [studentId]);
      toast("Report approved", "success");
      loadQA();
    } catch (err: any) {
      toast(err.message || "Approval failed", "error");
    }
  };

  if (fetchError) return <ErrorState message={fetchError} onRetry={loadQA} />;
  if (!qaReport) return <LoadingSpinner message="Loading QA report..." />;

  return (
    <div className="max-w-admin mx-auto">
      {/* Breadcrumb */}
      <header className="flex items-center justify-between mb-8">
        <nav className="flex items-center gap-2 text-sm font-medium">
          <span className="text-slate-500">Sessions</span>
          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <Link href={`/sessions/${params.id}`} className="text-slate-500 hover:text-primary transition-colors">Session</Link>
          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[#1A5276]">QA Review</span>
        </nav>
      </header>

      <h2 className="text-3xl font-extrabold text-[#1A5276] mb-8 font-heading tracking-tight">QA Review</h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-lg flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Total Reports</p>
            <p className="text-3xl font-bold text-on-surface">{qaReport.total}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">QA Passed</p>
            <p className="text-3xl font-bold text-on-surface">{qaReport.passed}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#F0FFF4] flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Flagged</p>
            <p className="text-3xl font-bold text-on-surface">{qaReport.flagged}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#FFF5F5] flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Pending Review</p>
            <p className="text-3xl font-bold text-on-surface">{qaReport.pending}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Flagged Reports Section */}
      {qaReport.flagged_details.length > 0 && (
        <section className="bg-white rounded-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-[#1A5276] flex items-center gap-2">
              Flagged Reports ({qaReport.flagged_details.length})
              <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                High Priority
              </span>
            </h3>
            <button
              onClick={handleApproveAll}
              className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Approve All
            </button>
          </div>
          <div className="space-y-4">
            {qaReport.flagged_details.map((f: any) => (
              <div key={f.student_id} className="bg-[#FFF5F5] rounded-md p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/students/${f.student_id}`}
                      className="text-[#1A5276] font-bold text-lg hover:underline"
                    >
                      {f.name}
                    </Link>
                    <span className="bg-white/60 text-slate-700 px-3 py-1 rounded text-xs font-semibold">
                      Class {f.class_level}
                    </span>
                  </div>
                  <button
                    onClick={() => handleApproveOne(f.student_id)}
                    className="bg-white/80 hover:bg-white text-green-700 px-4 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Approve
                  </button>
                </div>
                <div className="space-y-2">
                  {(f.flags || []).map((flag: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-red-700">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium">{flag}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Passed Reports Section */}
      {qaReport.passed > 0 && (
        <section className="bg-white rounded-lg p-6 flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1A5276]">Passed Reports ({qaReport.passed})</h3>
              <p className="text-xs text-slate-500">All automated and manual checks passed successfully.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
