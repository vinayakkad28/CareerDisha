"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sessions as sessionsApi } from "@/lib/api";

export default function SessionDetailPage() {
  const params = useParams();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const loadSession = () => {
    sessionsApi.get(Number(params.id)).then(setSession).catch(console.error);
  };

  useEffect(() => {
    loadSession();
  }, [params.id]);

  const handleAction = async (action: string) => {
    setLoading(action);
    try {
      const id = Number(params.id);
      if (action === "generate") await sessionsApi.generate(id);
      else if (action === "qa") await sessionsApi.runQA(id);
      else if (action === "pdf") await sessionsApi.generatePDFs(id);
      // Wait a moment for background tasks, then reload
      setTimeout(loadSession, 2000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(null);
    }
  };

  if (!session) return <div className="text-gray-400">Loading...</div>;

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
            onClick={() => handleAction("generate")}
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
          <a
            href={sessionsApi.downloadURL(Number(params.id))}
            className="px-4 py-2 bg-secondary text-white rounded-lg text-sm hover:bg-secondary-500"
          >
            Download ZIP
          </a>
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
    </div>
  );
}
