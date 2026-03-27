"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { schools as schoolsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={school.name}
        breadcrumbs={[
          { label: "Schools", href: "/schools" },
          { label: school.name },
        ]}
      />

      {/* School info card */}
      <div className="sa-card">
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-0.5">City</p>
            <p className="text-on-surface font-medium">{school.city}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-0.5">Board</p>
            <p className="text-on-surface font-medium">{school.board}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-0.5">Code</p>
            <p className="text-on-surface font-medium font-mono">{school.code}</p>
          </div>
          {school.contact_person && (
            <div>
              <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-0.5">Contact</p>
              <p className="text-on-surface font-medium">{school.contact_person}</p>
            </div>
          )}
          {school.contact_phone && (
            <div>
              <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide mb-0.5">Phone</p>
              <p className="text-on-surface font-medium font-mono">{school.contact_phone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sessions header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-semibold text-on-surface">Sessions</h2>
        <Link
          href={`/sessions/new?school_id=${school.id}`}
          className="btn-primary"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Session
        </Link>
      </div>

      {/* Sessions list */}
      <div className="sa-card !p-0 overflow-hidden">
        {(school.sessions || []).length === 0 ? (
          <div className="px-6 py-8 text-center text-on-surface-variant/50">No sessions yet.</div>
        ) : (
          <div className="divide-y divide-surface-container-high">
            {(school.sessions || []).map((s: any) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface transition-colors"
              >
                <div>
                  <p className="font-medium text-on-surface">
                    {s.session_date} &middot; Classes {(s.classes_assessed || []).join(", ")}
                  </p>
                  <p className="text-sm text-on-surface-variant mt-0.5">{s.total_students} students</p>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
