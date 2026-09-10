"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { reports as reportsApi, students as studentsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import { useToast } from "@/components/Toast";

export default function DeliveryPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {  }, []);

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
                    {item.pdf_available && (
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
            <h4 className="font-bold text-primary">Where the PDFs come from</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
              Reports are generated in a batch you start from the session page, then
              checked in QA. Only students with a finished PDF appear here. Marking one
              delivered timestamps it in the audit log for the school.
            </p>
          </div>
        </div>
        <div className="p-6 bg-surface-container-high rounded-xl flex items-start gap-4">
          <svg className="w-7 h-7 text-on-surface-variant flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-9 14l-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9z" />
          </svg>
          <div>
            <h4 className="font-bold text-on-surface">Offline delivery</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
              Download each report and hand it to the parent yourself, then mark the
              student delivered here. The count feeds the CBSE compliance certificate
              for this session.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
