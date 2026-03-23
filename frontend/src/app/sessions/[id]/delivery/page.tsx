"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { reports as reportsApi, students as studentsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import { useToast } from "@/components/Toast";

export default function DeliveryPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();

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

  return (
    <div>
      <div className="mb-6">
        <Link href={`/sessions/${params.id}`} className="text-sm text-gray-500 hover:text-primary">
          &larr; Session
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Delivery Checklist</h1>
        <div className="text-sm text-gray-500">
          {data.delivered}/{data.total} delivered
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Parent</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">PDF</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data.checklist || []).map((item: any) => (
              <tr key={item.student_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                <td className="px-4 py-3 text-sm">{item.class_level}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.parent_name}</td>
                <td className="px-4 py-3 text-sm font-mono">{item.parent_phone}</td>
                <td className="px-4 py-3">
                  {item.pdf_path && (
                    <a
                      href={studentsApi.downloadPdfURL(item.student_id)}
                      className="text-xs text-primary hover:underline"
                      target="_blank"
                    >
                      Download
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleDelivery(item.student_id, item.delivery_status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      item.delivery_status === "delivered"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600 hover:bg-yellow-100"
                    }`}
                  >
                    {item.delivery_status === "delivered" ? "Delivered" : "Mark Delivered"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
