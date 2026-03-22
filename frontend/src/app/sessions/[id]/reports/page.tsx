"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { reports as reportsApi } from "@/lib/api";

export default function QAReportsPage() {
  const params = useParams();
  const [qaReport, setQaReport] = useState<any>(null);

  const loadQA = () => {
    reportsApi.qaReport(Number(params.id)).then(setQaReport).catch(console.error);
  };

  useEffect(() => {
    loadQA();
  }, [params.id]);

  const handleApproveAll = async () => {
    if (!qaReport) return;
    const ids = qaReport.flagged_details.map((f: any) => f.student_id);
    await reportsApi.qaApprove(Number(params.id), ids);
    loadQA();
  };

  const handleApproveOne = async (studentId: number) => {
    await reportsApi.qaApprove(Number(params.id), [studentId]);
    loadQA();
  };

  if (!qaReport) return <div className="text-gray-400">Loading QA report...</div>;

  return (
    <div>
      <div className="mb-6">
        <Link href={`/sessions/${params.id}`} className="text-sm text-gray-500 hover:text-primary">
          &larr; Session
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-primary mb-6">QA Review</h1>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold">{qaReport.total}</p>
          <p className="text-sm text-gray-500">Total</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-green-700">{qaReport.passed}</p>
          <p className="text-sm text-gray-500">Passed</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-red-700">{qaReport.flagged}</p>
          <p className="text-sm text-gray-500">Flagged</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-500">{qaReport.pending}</p>
          <p className="text-sm text-gray-500">Pending</p>
        </div>
      </div>

      {/* Flagged Details */}
      {qaReport.flagged_details.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Flagged Reports</h2>
            <button
              onClick={handleApproveAll}
              className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
            >
              Approve All
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {qaReport.flagged_details.map((f: any) => (
              <div key={f.student_id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Link href={`/students/${f.student_id}`} className="font-medium text-primary hover:underline">
                      {f.name}
                    </Link>
                    <span className="text-sm text-gray-500 ml-2">Class {f.class_level}</span>
                  </div>
                  <button
                    onClick={() => handleApproveOne(f.student_id)}
                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Approve
                  </button>
                </div>
                <ul className="text-sm text-red-600 space-y-1">
                  {(f.flags || []).map((flag: string, i: number) => (
                    <li key={i}>• {flag}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
