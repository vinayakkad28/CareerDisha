"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sessions as sessionsApi, consent as consentApi } from "@/lib/api";
import { LoadingSpinner, ErrorState, ConfirmDialog } from "@/components/UIStates";
import { useToast } from "@/components/Toast";
import SessionTimeline from "@/components/SessionTimeline";

export default function SessionDetailPage() {
  const params = useParams();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [consentStatus, setConsentStatus] = useState<Record<number, boolean>>({});
  const [consentLoading, setConsentLoading] = useState(false);
  const { toast } = useToast();

  const loadSession = () => {
    setFetchError(null);
    sessionsApi
      .get(Number(params.id))
      .then(setSession)
      .catch((err: any) => setFetchError(err.message || "Failed to load session"));
  };

  const loadConsent = () => {
    consentApi
      .status(Number(params.id))
      .then((data: any) => {
        const map: Record<number, boolean> = {};
        (data.students || []).forEach((s: any) => {
          map[s.id] = s.consent_obtained;
        });
        setConsentStatus(map);
      })
      .catch(() => {});
  };

  const handleBulkConsent = async () => {
    setConsentLoading(true);
    try {
      await consentApi.bulkConsent(Number(params.id));
      toast("All students marked as consented", "success");
      loadConsent();
    } catch (err: any) {
      toast(err.message || "Failed to record consent", "error");
    } finally {
      setConsentLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
    loadConsent();
  }, [params.id]);

  const handleAction = async (action: string) => {
    setLoading(action);
    try {
      const id = Number(params.id);
      if (action === "generate") {
        await sessionsApi.generate(id);
        toast("Report generation started", "info");
      } else if (action === "qa") {
        await sessionsApi.runQA(id);
        toast("Scoring complete!", "success");
      } else if (action === "pdf") {
        await sessionsApi.generatePDFs(id);
        toast("PDF generation started", "info");
      }
      // Wait a moment for background tasks, then reload
      setTimeout(loadSession, 2000);
    } catch (err: any) {
      toast(err.message || "Action failed", "error");
    } finally {
      setLoading(null);
    }
  };

  if (fetchError) return <ErrorState message={fetchError} onRetry={loadSession} />;
  if (!session) return <LoadingSpinner />;

  const statusColors: Record<string, string> = {
    pending: "bg-gray-200 text-gray-700",
    scored: "bg-blue-100 text-blue-700",
    report_generated: "bg-purple-100 text-purple-700",
    qa_passed: "bg-green-100 text-green-700",
    qa_flagged: "bg-red-100 text-red-700",
    pdf_ready: "bg-green-200 text-green-800",
    delivered: "bg-green-300 text-green-900",
  };

  const sessionStatusColors: Record<string, string> = {
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
      <div className="mb-6">
        <Link href="/sessions" className="text-sm text-gray-500 hover:text-primary">
          &larr; Sessions
        </Link>
      </div>

      {/* Session Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">{session.school_name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {session.school_city} &middot; {session.session_date} &middot; Classes{" "}
              {(session.classes_assessed || []).join(", ")}
            </p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              sessionStatusColors[session.status] || "bg-gray-100"
            }`}
          >
            {session.status}
          </span>
        </div>

        {/* Session Timeline */}
        <SessionTimeline currentStatus={session.status} />

        {/* Stats */}
        {session.stats && (
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mt-4">
            {Object.entries(session.stats).map(([key, val]) => (
              <div key={key} className="text-center">
                <p className="text-lg font-bold text-gray-900">{val as number}</p>
                <p className="text-xs text-gray-500">{key.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 flex-wrap">
          <button
            onClick={() => setShowGenerateConfirm(true)}
            disabled={loading !== null}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {loading === "generate" ? "Generating..." : "Generate Reports"}
          </button>
          <button
            onClick={() => handleAction("qa")}
            disabled={loading !== null}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50"
          >
            {loading === "qa" ? "Running QA..." : "Run QA"}
          </button>
          <button
            onClick={() => handleAction("pdf")}
            disabled={loading !== null}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-600 disabled:opacity-50"
          >
            {loading === "pdf" ? "Generating PDFs..." : "Generate PDFs"}
          </button>
          <button
            onClick={async () => {
              try {
                const { downloadFile } = await import("@/lib/api");
                await downloadFile(
                  sessionsApi.downloadURL(Number(params.id)),
                  `session_${params.id}_reports.zip`
                );
                toast("ZIP downloaded!", "success");
              } catch (err: any) {
                toast(err.message || "Download failed", "error");
              }
            }}
            className="px-4 py-2 bg-secondary text-white rounded-lg text-sm hover:bg-secondary-500"
          >
            Download ZIP
          </button>
          <Link
            href={`/sessions/${params.id}/reports`}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            QA Review
          </Link>
          <Link
            href={`/sessions/${params.id}/delivery`}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            Delivery Checklist
          </Link>
        </div>

        {session.total_cost > 0 && (
          <p className="text-sm text-gray-500 mt-3">
            LLM Cost: ${session.total_cost.toFixed(4)} ({session.llm_provider})
          </p>
        )}
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Students ({(session.students || []).length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Holland Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">RIASEC</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Consent</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Report</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(session.students || []).map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/students/${s.id}`} className="text-primary hover:underline font-medium text-sm">
                      {s.name}
                    </Link>
                    <p className="text-xs text-gray-400">{s.parent_phone}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{s.class_level}</td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-primary">
                    {s.holland_code || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {s.riasec_scores
                      ? Object.entries(s.riasec_scores)
                          .map(([k, v]) => `${k}:${v}`)
                          .join(" ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        consentStatus[s.id]
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {consentStatus[s.id] ? "Yes" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[s.report_status] || "bg-gray-100"
                      }`}
                    >
                      {s.report_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {s.delivery_status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consent (DPDPA) */}
      <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Parental Consent (DPDPA)</h2>
        {(() => {
          const students = session.students || [];
          const consented = students.filter((s: any) => consentStatus[s.id]).length;
          return (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {consented} of {students.length} students have parental consent
              </p>
              <button
                onClick={handleBulkConsent}
                disabled={consentLoading || consented === students.length}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {consentLoading ? "Saving..." : "Mark All Consented (Paper Form)"}
              </button>
            </div>
          );
        })()}
      </div>

      {/* Confirm Dialog for Generate Reports */}
      {showGenerateConfirm && (
        <ConfirmDialog
          title="Generate Reports"
          message="This will call the LLM API and incur costs. Continue?"
          confirmLabel="Generate"
          variant="primary"
          onConfirm={() => {
            setShowGenerateConfirm(false);
            handleAction("generate");
          }}
          onCancel={() => setShowGenerateConfirm(false)}
        />
      )}
    </div>
  );
}
