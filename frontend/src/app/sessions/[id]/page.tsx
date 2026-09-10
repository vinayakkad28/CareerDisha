"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sessions as sessionsApi, consent as consentApi, students as studentsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState, ConfirmDialog } from "@/components/UIStates";
import { useToast } from "@/components/Toast";
import SessionTimeline from "@/components/SessionTimeline";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import AccessCodePanel from "@/components/AccessCodePanel";

const RIASEC_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  R: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
  I: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  A: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
  S: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
  E: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  C: { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200" },
};

export default function SessionDetailPage() {
  const params = useParams();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [consentStatus, setConsentStatus] = useState<Record<number, boolean>>({});
  const [consentLoading, setConsentLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [feeSaving, setFeeSaving] = useState<number | null>(null);
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

  // Fees are taken in cash or UPI at the school. Nothing is charged online —
  // this only records what was collected, which is what the session total and
  // the counsellor's commission are computed from.
  const toggleFee = async (studentId: number, currentlyPaid: boolean) => {
    setFeeSaving(studentId);
    try {
      await studentsApi.updateFee(studentId, { fee_paid: !currentlyPaid });
      toast(currentlyPaid ? "Marked unpaid" : "Fee recorded", "success");
      loadSession();
    } catch (err: any) {
      toast(err.message || "Could not update the fee record", "error");
    } finally {
      setFeeSaving(null);
    }
  };

  if (fetchError) return <ErrorState message={fetchError} onRetry={loadSession} />;
  if (!session) return <LoadingSpinner />;

  const students = session.students || [];
  const sessionStats = session.stats || {};
  const fees = session.fees || {
    paid_count: 0, unpaid_count: 0, collected_inr: 0, expected_inr: 0,
  };
  const consented = students.filter((s: any) => consentStatus[s.id]).length;

  // Filtered students based on search
  const filteredStudents = searchQuery
    ? students.filter((s: any) =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : students;

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          label="Total Students"
          value={sessionStats.total || students.length}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          }
          accent="blue"
        />
        <StatCard
          label="Scored"
          value={`${sessionStats.scored || 0}/${sessionStats.total || students.length}`}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M22 5.18L10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zm-2.21 5.04c.13.57.21 1.17.21 1.78 0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.25l1.44-1.44A9.9 9.9 0 0012 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.19-.22-2.33-.6-3.39l-1.61 1.61z"/></svg>
          }
          accent="green"
        />
        <StatCard
          label="Reports Generated"
          value={`${sessionStats.report_generated || sessionStats.generated || 0}/${sessionStats.total || students.length}`}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          }
          accent="purple"
        />
        <StatCard
          label="PDFs Ready"
          value={`${sessionStats.pdf_ready || 0}/${sessionStats.total || students.length}`}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
          }
          accent="gray"
          subtitle={
            session.total_cost > 0
              ? `Cost: $${session.total_cost.toFixed(4)} (${session.llm_provider})`
              : undefined
          }
        />
      </div>

      <AccessCodePanel sessionId={Number(params.id)} />

      {/* Fees collected offline */}
      <div className="bg-white p-6 rounded-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 w-full space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
            <h3 className="font-bold text-primary font-heading">Fees Collected (offline)</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{
                  width: `${fees.expected_inr > 0 ? (fees.collected_inr / fees.expected_inr) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-sm font-bold text-on-surface whitespace-nowrap">
              &#8377;{fees.collected_inr.toLocaleString("en-IN")} of &#8377;
              {fees.expected_inr.toLocaleString("en-IN")}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {fees.paid_count} paid &middot; {fees.unpaid_count} pending. Cash or UPI is
            taken at the school; tick each student off in the roster below.
          </p>
        </div>
      </div>

      {/* DPDPA Consent Compliance */}
      <div className="bg-white p-6 rounded-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 w-full space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
            <h3 className="font-bold text-primary font-heading">DPDPA Consent Compliance</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{
                  width: `${students.length > 0 ? (consented / students.length) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-sm font-bold text-on-surface">{consented}/{students.length} consented</span>
          </div>
        </div>
        <button
          onClick={handleBulkConsent}
          disabled={consentLoading || consented === students.length}
          className="px-6 py-2.5 bg-green-100 text-green-700 font-bold rounded-lg hover:bg-green-200 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {consentLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-green-400/30 border-t-green-700 rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            "Mark All Consented"
          )}
        </button>
      </div>

      {/* Actions Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Generate Reports - Navy gradient */}
        <button
          onClick={() => setShowGenerateConfirm(true)}
          disabled={loading !== null}
          className="px-6 py-2.5 bg-brand-gradient text-white font-bold rounded hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === "generate" ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z"/></svg>
              Generate Reports
            </>
          )}
        </button>

        {/* Run QA - Gold */}
        <button
          onClick={() => handleAction("qa")}
          disabled={loading !== null}
          className="px-6 py-2.5 bg-amber-100 text-amber-800 font-bold rounded hover:bg-amber-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === "qa" ? (
            <>
              <span className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-800 rounded-full animate-spin" />
              Running QA...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
              Run QA
            </>
          )}
        </button>

        {/* Generate PDFs - Green */}
        <button
          onClick={() => handleAction("pdf")}
          disabled={loading !== null}
          className="px-6 py-2.5 bg-green-100 text-green-800 font-bold rounded hover:bg-green-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === "pdf" ? (
            <>
              <span className="w-4 h-4 border-2 border-green-400/30 border-t-green-800 rounded-full animate-spin" />
              Generating PDFs...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
              Generate PDFs
            </>
          )}
        </button>

        {/* Download ZIP - Disabled state */}
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
          className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h-2v-2h-2v-2h2V8h2v2h2v2z"/></svg>
          Download ZIP
        </button>

        {/* QA Review - Outlined */}
        <Link
          href={`/sessions/${params.id}/reports`}
          className="px-6 py-2.5 border-2 border-slate-200 text-slate-600 font-bold rounded hover:bg-slate-50 transition-colors"
        >
          QA Review
        </Link>
      </div>

      {/* Delivery Checklist - Separate button below */}
      <div>
        <Link
          href={`/sessions/${params.id}/delivery`}
          className="px-6 py-2.5 border-2 border-slate-200 text-slate-600 font-bold rounded hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          Delivery Checklist
        </Link>
      </div>

      {/* CBSE compliance artefacts.
          The backend has generated these since March with nothing in the UI
          reaching them. The certificate evidences Clause 2.4.12 compliance for
          the principal; the parent circular is what they hand a parent who
          queries the fee, which matters under the UP fee-regulation rules. */}
      <section className="bg-white rounded-lg p-6 space-y-4">
        <div>
          <h3 className="font-extrabold text-primary font-heading">School paperwork</h3>
          <p className="text-sm text-slate-500 mt-1">
            Documents the school can file or show to parents for this session.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              try {
                const { downloadFile } = await import("@/lib/api");
                await downloadFile(
                  sessionsApi.complianceCertificateURL(Number(params.id)),
                  `compliance_certificate_session_${params.id}.pdf`
                );
                toast("Compliance certificate downloaded", "success");
              } catch (err: any) {
                toast(err.message || "Could not generate the certificate", "error");
              }
            }}
            className="px-6 py-2.5 border-2 border-primary text-primary font-bold rounded hover:bg-primary-50 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            CBSE Compliance Certificate
          </button>

          <button
            onClick={async () => {
              try {
                const { downloadFile } = await import("@/lib/api");
                await downloadFile(
                  sessionsApi.parentCircularURL(Number(params.id)),
                  `parent_circular_session_${params.id}.pdf`
                );
                toast("Parent circular downloaded", "success");
              } catch (err: any) {
                toast(err.message || "Could not generate the circular", "error");
              }
            }}
            className="px-6 py-2.5 border-2 border-slate-200 text-slate-600 font-bold rounded hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            Parent Circular
          </button>
        </div>
        <p className="text-xs text-slate-400">
          The certificate records students assessed, parental consent obtained and
          reports delivered, against CBSE Affiliation Bye-Laws Clause 2.4.12.
        </p>
      </section>

      {/* Student Progress Detail Table */}
      <section className="bg-white rounded-lg overflow-hidden">
        <div className="px-8 py-5 flex justify-between items-center border-b border-surface-container-high">
          <h3 className="font-extrabold text-primary font-heading">Student Progress Detail</h3>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-surface-container-high text-sm border-none rounded-full focus:ring-2 focus:ring-primary w-64"
              placeholder="Search students..."
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-high">
              <tr>
                <th className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Name</th>
                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Class</th>
                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Holland</th>
                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">RIASEC Scores</th>
                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Consent</th>
                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Report</th>
                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Fee</th>
                <th className="px-8 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {filteredStudents.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-8 py-4">
                    <Link
                      href={`/students/${s.id}`}
                      className="font-bold text-primary hover:underline underline-offset-4 decoration-primary/30"
                    >
                      {s.name}
                    </Link>
                    {s.parent_phone && (
                      <p className="text-xs text-on-surface-variant/60 mt-0.5">
                        {s.parent_phone}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">
                      {s.class_level}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <code className="text-xs font-bold text-primary tracking-tighter">
                      {s.holland_code || "\u2014"}
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    {s.riasec_scores ? (
                      <div className="flex gap-1.5">
                        {Object.entries(s.riasec_scores)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 3)
                          .map(([k, v]) => {
                            const colors = RIASEC_COLORS[k] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
                            return (
                              <span
                                key={k}
                                className={`w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-black border ${colors.bg} ${colors.text} ${colors.border}`}
                              >
                                {k}:{String(v)}
                              </span>
                            );
                          })}
                      </div>
                    ) : (
                      <span className="text-on-surface-variant/30">{"\u2014"}</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {consentStatus[s.id] ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">Consented</span>
                    ) : (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">Missing</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <StatusBadge status={s.report_status || "pending"} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => toggleFee(s.id, !!s.fee_paid)}
                      disabled={feeSaving === s.id}
                      title={s.fee_paid ? "Click to reverse this fee record" : "Record the fee collected in person"}
                      className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors disabled:opacity-50 ${
                        s.fee_paid
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {s.fee_paid ? `\u20B9${s.fee_amount || 0} paid` : "Mark paid"}
                    </button>
                  </td>
                  <td className="px-8 py-4 text-center">
                    <StatusBadge status={s.delivery_status || "pending"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination footer */}
        <div className="px-8 py-4 bg-surface-container-high/30 flex justify-between items-center text-xs text-slate-500 font-medium">
          <p>Showing {filteredStudents.length} of {students.length} students</p>
          <div className="flex gap-2">
            <button className="p-1 hover:text-primary transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button className="p-1 hover:text-primary transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          </div>
        </div>
      </section>

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
