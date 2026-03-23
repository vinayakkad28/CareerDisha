"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { students as studentsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import { useToast } from "@/components/Toast";

export default function StudentDetailPage() {
  const params = useParams();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    studentsApi
      .get(Number(params.id))
      .then(setStudent)
      .catch((err) => setError(err.message || "Failed to load student"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleRegenerate = async () => {
    try {
      toast("Regenerating report...", "info");
      await studentsApi.regenerate(Number(params.id));
      const updated = await studentsApi.get(Number(params.id));
      setStudent(updated);
      toast("Report regenerated successfully", "success");
    } catch (err: any) {
      toast(err.message || "Failed to regenerate report", "error");
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const report = student.report_content || {};
  const scores = student.riasec_scores || {};

  return (
    <div>
      <div className="mb-6">
        <Link href={`/sessions/${student.session_id}`} className="text-sm text-gray-500 hover:text-primary">
          &larr; Session
        </Link>
      </div>

      {/* Student Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">{student.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Class {student.class_level}{student.section && `-${student.section}`} &middot;{" "}
              Holland Code: <span className="font-mono font-bold">{student.holland_code || "—"}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerate}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              Regenerate Report
            </button>
            {student.pdf_path && (
              <a
                href={studentsApi.downloadPdfURL(student.id)}
                className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-700"
                target="_blank"
              >
                Download PDF
              </a>
            )}
          </div>
        </div>

        <div className="flex gap-6 mt-3 text-sm text-gray-500">
          <span>Parent: {student.parent_name}</span>
          <span>Phone: {student.parent_phone}</span>
          <span>Status: {student.report_status}</span>
        </div>
      </div>

      {/* RIASEC Scores */}
      {Object.keys(scores).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">RIASEC Profile</h2>
          <div className="grid grid-cols-6 gap-4">
            {["R", "I", "A", "S", "E", "C"].map((type) => (
              <div key={type} className="text-center">
                <div className="relative h-32 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-lg transition-all"
                    style={{ height: `${scores[type] || 0}%` }}
                  />
                </div>
                <p className="text-xs font-medium mt-2">{type}</p>
                <p className="text-sm font-bold">{scores[type] || 0}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report Content */}
      {report.career_matches && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Career Matches</h2>
          <div className="space-y-4">
            {(report.career_matches || []).map((career: any, i: number) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-primary">
                    #{career.rank || i + 1} {career.career_name}
                  </h3>
                  {career.match_score && (
                    <span className="text-sm font-medium text-accent">
                      {career.match_score}% match
                    </span>
                  )}
                </div>
                {career.why_it_fits && (
                  <p className="text-sm text-gray-600 mt-2">{career.why_it_fits}</p>
                )}
                {career.education_pathway && (
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>Path:</strong> {career.education_pathway}
                  </p>
                )}
                {career.salary_range && (
                  <p className="text-sm text-gray-500">
                    <strong>Salary:</strong> {career.salary_range}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stream Recommendation */}
      {report.stream_recommendation && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stream Recommendation</h2>
          <div className="bg-primary-50 rounded-lg p-4">
            <p className="font-semibold text-primary text-lg">
              {report.stream_recommendation.recommended_stream}
            </p>
            <p className="text-sm text-gray-700 mt-2">
              {report.stream_recommendation.reasoning}
            </p>
          </div>
        </div>
      )}

      {/* Action Plan */}
      {report.action_plan && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Action Plan</h2>
          {Object.entries(report.action_plan).map(([period, items]: [string, any]) => (
            <div key={period} className="mb-4">
              <h3 className="font-medium text-gray-800 capitalize mb-2">
                {period.replace(/_/g, " ")}
              </h3>
              <ul className="space-y-1">
                {(Array.isArray(items) ? items : []).map((item: string, i: number) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-accent">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Parent Section */}
      {report.parent_section && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Parent Section (अभिभावकों के लिए)
          </h2>
          {report.parent_section.recommendation_summary && (
            <p className="text-sm text-gray-700 mb-3">
              {report.parent_section.recommendation_summary}
            </p>
          )}
          {report.parent_section.what_to_do_now && (
            <div className="mb-3">
              <h3 className="font-medium text-sm mb-1">What to do now:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {(report.parent_section.what_to_do_now || []).map((item: string, i: number) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
