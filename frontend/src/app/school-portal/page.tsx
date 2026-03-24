"use client";

import { useEffect, useState } from "react";
import { sessions as sessionsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState, EmptyState } from "@/components/UIStates";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function SchoolPortalPage() {
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sessionsApi
      .list()
      .then(setSessionsList)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const downloadCertificate = (sessionId: number) => {
    const token = localStorage.getItem("cd_token");
    window.open(`${BASE_URL}/sessions/${sessionId}/compliance-certificate/pdf?token=${token}`, "_blank");
  };

  if (loading) return <LoadingSpinner message="Loading school data..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-2">School Portal</h1>
      <p className="text-gray-500 text-sm mb-6">
        View your school&apos;s career assessment sessions and download compliance certificates.
      </p>

      {sessionsList.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="No career assessment sessions have been conducted for your school yet."
        />
      ) : (
        <div className="space-y-4">
          {sessionsList.map((s: any) => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-lg text-gray-900">
                    {s.school_name || "Session"} — {s.session_date}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {s.total_students || 0} students | Classes: {(s.classes_assessed || []).join(", ")} | Status: {s.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/sessions/${s.id}`}
                    className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => downloadCertificate(s.id)}
                    className="text-sm bg-secondary text-white px-3 py-1.5 rounded-lg hover:bg-secondary/90"
                  >
                    CBSE Certificate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
