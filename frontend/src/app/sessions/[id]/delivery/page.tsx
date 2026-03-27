"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { reports as reportsApi, students as studentsApi, whatsapp as whatsappApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import { useToast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";

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
    <div className="space-y-6">
      <PageHeader
        title="Delivery Checklist"
        subtitle={`${data.delivered}/${data.total} delivered`}
        breadcrumbs={[
          { label: "Sessions", href: "/sessions" },
          { label: "Session", href: `/sessions/${params.id}` },
          { label: "Delivery" },
        ]}
        actions={
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
            className="btn-primary"
            title={waConfigured ? "Send all reports via WhatsApp" : "WhatsApp not configured \u2014 set WHATSAPP_PROVIDER in .env"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send All via WhatsApp
          </button>
        }
      />

      {/* Progress bar */}
      <div className="sa-card !py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-on-surface-variant">Delivery Progress</span>
          <span className="text-sm font-heading font-bold text-on-surface">{deliveredPct}%</span>
        </div>
        <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${deliveredPct}%` }}
          />
        </div>
      </div>

      {/* Delivery table */}
      <div className="sa-card !p-0 overflow-hidden">
        <table className="sa-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Parent</th>
              <th>Phone</th>
              <th>PDF</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data.checklist || []).map((item: any) => (
              <tr key={item.student_id}>
                <td className="font-medium text-on-surface">{item.name}</td>
                <td className="text-on-surface-variant">{item.class_level}</td>
                <td className="text-on-surface-variant">{item.parent_name}</td>
                <td className="font-mono text-on-surface-variant">{item.parent_phone}</td>
                <td>
                  {item.pdf_path && (
                    <a
                      href={studentsApi.downloadPdfURL(item.student_id)}
                      className="text-xs font-medium text-primary hover:text-primary-700 transition-colors"
                      target="_blank"
                    >
                      Download
                    </a>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleDelivery(item.student_id, item.delivery_status)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                        item.delivery_status === "delivered"
                          ? "bg-accent-100 text-accent-600"
                          : "bg-surface-container-high text-on-surface-variant hover:bg-secondary-50 hover:text-secondary"
                      }`}
                    >
                      {item.delivery_status === "delivered" ? "Delivered" : "Mark Delivered"}
                    </button>
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
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-accent-600 text-white rounded font-medium hover:bg-accent transition-colors disabled:opacity-40"
                      title={!waConfigured ? "WhatsApp not configured" : !item.pdf_path ? "PDF not ready" : "Send via WhatsApp"}
                    >
                      WA
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
