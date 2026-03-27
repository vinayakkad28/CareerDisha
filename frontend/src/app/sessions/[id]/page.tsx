"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sessions as sessionsApi, consent as consentApi } from "@/lib/api";
import { LoadingSpinner, ErrorState, ConfirmDialog } from "@/components/UIStates";
import { useToast } from "@/components/Toast";
import SessionTimeline from "@/components/SessionTimeline";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";

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

  // Auto-poll when generating or other background tasks are running
  useEffect(() => {
    if (!session) return;
    const isActive = ["generating", "scoring"].includes(session.status);
    if (!isActive) return;
    const interval = setInterval(loadSession, 3000);
    return () => clearInterval(interval);
  }, [session?.status]);

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

  const students = session.students || [];
  const sessionStats = session.stats || {};
  const consented = students.filter((s: any) => consentStatus[s.id]).length;

  return (
    <div className="space-y-8">
      {/* Page Header with breadcrumbs */}
      <PageHeader
        title={session.school_name}
        subtitle={`${session.school_city} · ${session.session_date} · Classes ${(session.classes_assessed || []).join(", ")}`}
        breadcrumbs={[
          { label: "Sessions", href: "/sessions" },
          { label: session.school_name, href: `/sessions/${params.id}` },
          { label: `Session ${params.id}` },
        ]}
        actions={
          <StatusBadge status={session.status} size="md" />
        }
      />

      {/* Session Timeline */}
      <SessionTimeline currentStatus={session.status} stats={session.stats} />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Students"
          value={sessionStats.total || students.length}
          icon="👨‍🎓"
          accent="blue"
        />
        <StatCard
          label="Scored"
          value={sessionStats.scored || 0}
          icon="✅"
          accent="green"
        />
        <StatCard
          label="Reports Generated"
          value={sessionStats.report_generated || sessionStats.generated || 0}
          icon="📄"
          accent="purple"
        />
        <StatCard
          label="PDFs Ready"
          value={sessionStats.pdf_ready || 0}
          icon="📑"
          accent="gray"
          subtitle={
            session.total_cost > 0
              ? `Cost: $${session.total_cost.toFixed(4)} (${session.llm_provider})`
              : undefined
          }
        />
      </div>

      {/* Action Toolbar */}
      <div className="sa-card">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">
          Actions
        </h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowGenerateConfirm(true)}
            disabled={loading !== null}
            className="btn-primary"
          >
            {loading === "generate" ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <span>📝</span>
                Generate Reports
              </>
            )}
          </button>
          <button
            onClick={() => handleAction("qa")}
            disabled={loading !== null}
            className="btn-gold"
          >
            {loading === "qa" ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running QA...
              </>
            ) : (
              <>
                <span>🔍</span>
                Run QA
              </>
            )}
          </button>
          <button
            onClick={() => handleAction("pdf")}
            disabled={loading !== null}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded transition-all duration-200 bg-accent-600 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "pdf" ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating PDFs...
              </>
            ) : (
              <>
                <span>📄</span>
                Generate PDFs
              </>
            )}
          </button>
          <button
            onClick={async () => {
              if (!session?.stats?.pdf_ready) {
                toast("No PDFs ready yet. Generate reports first, then run QA and generate PDFs.", "warning");
                return;
              }
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
            disabled={!session?.stats?.pdf_ready}
            className="btn-gold disabled:opacity-40 disabled:cursor-not-allowed disabled:filter-none disabled:shadow-none"
          >
            <span>📦</span>
            Download ZIP
          </button>

          <div className="w-px bg-surface-container-high mx-1 self-stretch" />

          <Link
            href={`/sessions/${params.id}/reports`}
            className="btn-ghost"
          >
            <span>📋</span>
            QA Review
          </Link>
          <Link
            href={`/sessions/${params.id}/delivery`}
            className="btn-ghost"
          >
            <span>🚚</span>
            Delivery
          </Link>
        </div>
      </div>

      {/* Student Table */}
      <div className="sa-card !p-0 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-on-surface">
            Students
            <span className="ml-2 text-sm font-normal text-on-surface-variant">
              ({students.length})
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Class</th>
                <th>Holland Code</th>
                <th>RIASEC Scores</th>
                <th className="text-center">Consent</th>
                <th className="text-center">Report</th>
                <th className="text-center">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s: any) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/students/${s.id}`}
                      className="text-primary hover:text-primary-700 hover:underline font-medium text-sm transition-colors"
                    >
                      {s.name}
                    </Link>
                    {s.parent_phone && (
                      <p className="text-xs text-on-surface-variant/60 mt-0.5">
                        {s.parent_phone}
                      </p>
                    )}
                  </td>
                  <td>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-surface-container-high text-sm font-semibold text-on-surface-variant">
                      {s.class_level}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono font-bold text-primary text-sm tracking-wide">
                      {s.holland_code || "—"}
                    </span>
                  </td>
                  <td>
                    {s.riasec_scores ? (
                      <div className="flex gap-1.5 flex-wrap">
                        {Object.entries(s.riasec_scores).map(
                          ([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center gap-0.5 text-xs bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded font-mono"
                            >
                              <span className="font-semibold text-on-surface">
                                {k}
                              </span>
                              :{String(v)}
                            </span>
                          )
                        )}
                      </div>
                    ) : (
                      <span className="text-on-surface-variant/30">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    <StatusBadge
                      status={consentStatus[s.id] ? "consented" : "pending"}
                    />
                  </td>
                  <td className="text-center">
                    <StatusBadge status={s.report_status || "pending"} />
                  </td>
                  <td className="text-center">
                    <StatusBadge
                      status={s.delivery_status || "pending"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DPDPA Consent Section */}
      <div className="sa-card">
        <h2 className="text-lg font-heading font-semibold text-on-surface mb-5">
          Parental Consent (DPDPA)
        </h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">{consented}</span>{" "}
              of{" "}
              <span className="font-semibold text-on-surface">
                {students.length}
              </span>{" "}
              students have parental consent
            </p>
            {students.length > 0 && (
              <div className="mt-3 w-64 h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-accent"
                  style={{
                    width: `${
                      students.length > 0
                        ? (consented / students.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            )}
          </div>
          <button
            onClick={handleBulkConsent}
            disabled={consentLoading || consented === students.length}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded transition-all duration-200 bg-accent-600 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {consentLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <span>✅</span>
                Mark All Consented (Paper Form)
              </>
            )}
          </button>
        </div>
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
