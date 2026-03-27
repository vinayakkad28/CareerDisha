"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { reports as reportsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import { useToast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";

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
    <div className="space-y-6">
      <PageHeader
        title="QA Review"
        breadcrumbs={[
          { label: "Sessions", href: "/sessions" },
          { label: "Session", href: `/sessions/${params.id}` },
          { label: "QA Review" },
        ]}
      />

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="sa-card text-center">
          <p className="text-3xl font-heading font-bold text-on-surface">{qaReport.total}</p>
          <p className="text-sm text-on-surface-variant mt-1">Total</p>
        </div>
        <div className="rounded p-6 bg-accent-50 text-center">
          <p className="text-3xl font-heading font-bold text-accent-600">{qaReport.passed}</p>
          <p className="text-sm text-on-surface-variant mt-1">Passed</p>
        </div>
        <div className="rounded p-6 bg-red-50 text-center">
          <p className="text-3xl font-heading font-bold text-red-700">{qaReport.flagged}</p>
          <p className="text-sm text-on-surface-variant mt-1">Flagged</p>
        </div>
        <div className="rounded p-6 bg-surface-container-high text-center">
          <p className="text-3xl font-heading font-bold text-on-surface-variant">{qaReport.pending}</p>
          <p className="text-sm text-on-surface-variant mt-1">Pending</p>
        </div>
      </div>

      {/* Flagged Details */}
      {qaReport.flagged_details.length > 0 && (
        <div className="sa-card !p-0">
          <div className="px-6 py-5 flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold text-on-surface">Flagged Reports</h2>
            <button
              onClick={handleApproveAll}
              className="btn-primary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve All
            </button>
          </div>
          <div className="divide-y divide-surface-container-high">
            {qaReport.flagged_details.map((f: any) => (
              <div key={f.student_id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Link href={`/students/${f.student_id}`} className="font-heading font-semibold text-primary hover:text-primary-700 transition-colors">
                      {f.name}
                    </Link>
                    <span className="text-sm text-on-surface-variant">Class {f.class_level}</span>
                  </div>
                  <button
                    onClick={() => handleApproveOne(f.student_id)}
                    className="btn-ghost !px-3 !py-1.5 !text-xs"
                  >
                    Approve
                  </button>
                </div>
                <div className="rounded bg-red-50/70 px-4 py-3 space-y-1">
                  {(f.flags || []).map((flag: string, i: number) => (
                    <p key={i} className="text-sm text-red-700 flex items-start gap-2">
                      <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {flag}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
