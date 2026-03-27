"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { reports as reportsApi, students as studentsApi, whatsapp as whatsappApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import { useToast } from "@/components/Toast";

export default function DeliveryPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [waConfigured, setWaConfigured] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    whatsappApi.status().then(d => setWaConfigured(d.configured)).catch(() => {});
  }, []);

  const loadData = () => {
    setFetchError(null);
    reportsApi
      .deliveryChecklist(Number(params.id))
      .then(setData)
      .catch((err: any) => setFetchError(err.message || "Failed to load delivery checklist"));
  };

  useEffect(() => {
    loadData();
  }, [params.id]);

  const toggleDelivery = async (studentId: number, currentStatus: string) => {
    const newStatus = currentStatus === "delivered" ? "pending" : "delivered";
    try {
      await studentsApi.updateDelivery(studentId, newStatus);
      toast(
        newStatus === "delivered" ? "Marked as delivered" : "Marked as pending",
        "success"
      );
      loadData();
    } catch (err: any) {
      toast(err.message || "Failed to update delivery status", "error");
    }
  };

  if (fetchError) return <ErrorState message={fetchError} onRetry={loadData} />;
  if (!data) return <LoadingSpinner />;

  const deliveredPct = data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0;

  return (
    <div className="max-w-admin mx-auto space-y-8">
      {/* Breadcrumb */}
      <nav className="flex text-sm text-slate-500 font-medium">
        <a className="hover:text-primary transition-colors" href="/sessions">Sessions</a>
        <span className="mx-2 text-slate-300">/</span>
        <a className="hover:text-primary transition-colors" href={`/sessions/${params.id}`}>Session</a>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-primary font-semibold">Delivery Checklist</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-primary font-heading tracking-tight">Delivery Checklist</h1>
          <p className="mt-1 text-on-surface-variant font-medium flex items-center gap-2">
            Delivery Progress: <span className="text-accent-600 font-bold">{data.delivered}/{data.total} delivered</span>
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              toast("Sending reports via WhatsApp...", "info");
              const result = await whatsappApi.sendBulk(Number(params.id));
              toast(`Sent: ${result.sent}, Failed: ${result.failed}`, result.failed > 0 ? "warning" : "success");
              loadData();
            } catch (err: any) {
              toast(err.message || "WhatsApp send failed", "error");
            }
          }}
          disabled={!waConfigured}
          className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          title={waConfigured ? "Send all reports via WhatsApp" : "WhatsApp not configured -- set WHATSAPP_PROVIDER in .env"}
        >
          Send All via WhatsApp
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
          style={{ width: `${deliveredPct}%` }}
        />
      </div>

      {/* Delivery Table Container */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high">
                <th className="px-6 py-4 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest">Student</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest">Class</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest">Parent</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest">Phone</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest">PDF</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest text-center">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {(data.checklist || []).map((item: any) => (
                <tr
                  key={item.student_id}
                  className={`group hover:bg-surface-container-low transition-colors ${
                    item.delivery_status === "delivered" ? "bg-green-50/30" : ""
                  }`}
                >
                  <td className="px-6 py-4 font-semibold text-primary">{item.name}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-[#D6EAF8] text-primary text-[11px] font-bold rounded">
                      {item.class_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{item.parent_name}</td>
                  <td className="px-6 py-4 font-mono text-xs">{item.parent_phone}</td>
                  <td className="px-6 py-4">
                    {item.pdf_path && (
                      <a
                        href={studentsApi.downloadPdfURL(item.student_id)}
                        className="text-primary font-bold hover:underline flex items-center gap-1"
                        target="_blank"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleDelivery(item.student_id, item.delivery_status)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-full flex items-center gap-1.5 transition-colors ${
                        item.delivery_status === "delivered"
                          ? "bg-accent text-white"
                          : "bg-surface-container-high text-on-surface-variant hover:bg-outline-variant"
                      }`}
                    >
                      {item.delivery_status === "delivered" ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Delivered
                        </>
                      ) : (
                        "Mark Delivered"
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={async () => {
                        try {
                          await whatsappApi.send(item.student_id);
                          toast(`Sent to ${item.parent_name || item.name}`, "success");
                          loadData();
                        } catch (err: any) {
                          toast(err.message, "error");
                        }
                      }}
                      disabled={!waConfigured || !item.pdf_path}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-colors disabled:opacity-40"
                      title={!waConfigured ? "WhatsApp not configured" : !item.pdf_path ? "PDF not ready" : "Send via WhatsApp"}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data.total > 0 && (
          <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">
              Showing {(data.checklist || []).length} of {data.total} students
            </span>
          </div>
        )}
      </div>

      {/* Operational Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-[#D6EAF8] rounded-xl flex items-start gap-4">
          <svg className="w-7 h-7 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-bold text-primary">Auto-Delivery Sync</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
              PDF reports are automatically generated after the assessment is completed. Marking a student as &quot;Delivered&quot; will timestamp the activity in the audit log for school principals.
            </p>
          </div>
        </div>
        <div className="p-6 bg-surface-container-high rounded-xl flex items-start gap-4">
          <svg className="w-7 h-7 text-on-surface-variant flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
          <div>
            <h4 className="font-bold text-on-surface">WhatsApp API Status</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
              Bulk WhatsApp delivery is currently throttled to 50 messages per minute to comply with provider limits. Use &quot;Send All&quot; to queue all pending reports for delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
