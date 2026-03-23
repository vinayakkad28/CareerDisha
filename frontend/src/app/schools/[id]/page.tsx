"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { schools as schoolsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";

export default function SchoolDetailPage() {
  const params = useParams();
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      schoolsApi
        .get(Number(params.id))
        .then(setSchool)
        .catch((err) => setError(err.message || "Failed to load school"))
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const statusColors: Record<string, string> = {
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
        <Link href="/schools" className="text-sm text-gray-500 hover:text-primary">
          &larr; Schools
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h1 className="text-2xl font-bold text-primary">{school.name}</h1>
        <div className="flex gap-6 mt-2 text-sm text-gray-500">
          <span>{school.city}</span>
          <span>{school.board}</span>
          <span>Code: {school.code}</span>
          {school.contact_person && <span>Contact: {school.contact_person}</span>}
          {school.contact_phone && <span>Phone: {school.contact_phone}</span>}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
        <Link
          href={`/sessions/new?school_id=${school.id}`}
          className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-700"
        >
          + New Session
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
        {(school.sessions || []).length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400">No sessions yet.</div>
        ) : (
          (school.sessions || []).map((s: any) => (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {s.session_date} &middot; Classes {(s.classes_assessed || []).join(", ")}
                </p>
                <p className="text-sm text-gray-500">{s.total_students} students</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[s.status] || "bg-gray-100"}`}>
                {s.status}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
