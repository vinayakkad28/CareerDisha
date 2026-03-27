"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { students as studentsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import { useToast } from "@/components/Toast";
import RiasecRadarChart, { RiasecBarChart } from "@/components/RiasecRadarChart";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

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
  const hasScores = Object.keys(scores).length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title={student.name}
        subtitle={`Class ${student.class_level}${student.section ? `-${student.section}` : ""}`}
        breadcrumbs={[
          { label: "Sessions", href: "/sessions" },
          { label: "Session", href: `/sessions/${student.session_id}` },
          { label: student.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              className="btn-ghost"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </button>
            {student.pdf_path && (
              <a
                href={studentsApi.downloadPdfURL(student.id)}
                className="btn-primary"
                target="_blank"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </a>
            )}
          </div>
        }
      />

      {/* Student Info Card */}
      <div className="sa-card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-heading font-bold text-white">
                {student.name?.charAt(0)?.toUpperCase() || "S"}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold text-on-surface">{student.name}</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Class {student.class_level}{student.section && `-${student.section}`}
              </p>
              {student.holland_code && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-primary-100 text-primary text-sm font-heading font-bold tracking-wider">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {student.holland_code}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{student.parent_name || "N/A"}</span>
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{student.parent_phone || "N/A"}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <StatusBadge status={student.report_status || "pending"} size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* RIASEC Profile Section */}
      {hasScores && (
        <div className="sa-card">
          <h2 className="text-lg font-heading font-semibold text-on-surface mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            RIASEC Interest Profile
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Radar Chart */}
            <div className="flex items-center justify-center">
              <RiasecRadarChart scores={scores} size={350} />
            </div>
            {/* Bar Chart */}
            <div className="flex flex-col justify-center">
              <RiasecBarChart scores={scores} />
            </div>
          </div>
        </div>
      )}

      {/* Career Matches */}
      {report.career_matches && report.career_matches.length > 0 && (
        <div className="sa-card">
          <h2 className="text-lg font-heading font-semibold text-on-surface mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Career Matches
          </h2>
          <div className="space-y-4">
            {(report.career_matches || []).map((career: any, i: number) => (
              <div
                key={i}
                className="rounded bg-surface-container-high/50 p-5 hover:bg-surface-container-high transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Rank Badge */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center">
                      <span className="text-sm font-heading font-bold text-white">#{career.rank || i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold text-on-surface text-base">
                        {career.career_name}
                      </h3>
                      {career.career_name_hi && (
                        <p className="text-sm text-on-surface-variant mt-0.5">{career.career_name_hi}</p>
                      )}
                      {career.why_it_fits && (
                        <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">{career.why_it_fits}</p>
                      )}
                    </div>
                  </div>
                  {/* Match Score */}
                  {career.match_score && (
                    <div className="flex-shrink-0 text-right">
                      <span className="text-2xl font-heading font-bold text-primary">{career.match_score}%</span>
                      <p className="text-xs text-on-surface-variant/50">match</p>
                    </div>
                  )}
                </div>

                {/* Match bar */}
                {career.match_score && (
                  <div className="mt-3 w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${career.match_score}%` }}
                    />
                  </div>
                )}

                {/* Details grid */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {career.education_pathway && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-on-surface-variant/40 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      </svg>
                      <div>
                        <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide">Pathway</p>
                        <p className="text-sm text-on-surface-variant mt-0.5">{career.education_pathway}</p>
                      </div>
                    </div>
                  )}
                  {career.key_exams && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-on-surface-variant/40 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <div>
                        <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide">Key Exams</p>
                        <p className="text-sm text-on-surface-variant mt-0.5">
                          {Array.isArray(career.key_exams) ? career.key_exams.join(", ") : career.key_exams}
                        </p>
                      </div>
                    </div>
                  )}
                  {career.top_colleges && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-on-surface-variant/40 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <div>
                        <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide">Top Colleges</p>
                        <p className="text-sm text-on-surface-variant mt-0.5">
                          {Array.isArray(career.top_colleges) ? career.top_colleges.join(", ") : career.top_colleges}
                        </p>
                      </div>
                    </div>
                  )}
                  {career.salary_range && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-on-surface-variant/40 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wide">Salary Range</p>
                        <p className="text-sm text-on-surface-variant mt-0.5">{career.salary_range}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stream Recommendation */}
      {report.stream_recommendation && (
        <div className="sa-card">
          <h2 className="text-lg font-heading font-semibold text-on-surface mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Stream Recommendation
          </h2>
          <div className="rounded bg-primary-50 p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl font-heading font-bold text-primary">
                {report.stream_recommendation.recommended_stream}
              </span>
              {report.stream_recommendation.confidence && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-100 text-accent-600">
                  {report.stream_recommendation.confidence}% confidence
                </span>
              )}
            </div>
            {report.stream_recommendation.reasoning && (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {report.stream_recommendation.reasoning}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Plan */}
      {report.action_plan && Object.keys(report.action_plan).length > 0 && (
        <div className="sa-card">
          <h2 className="text-lg font-heading font-semibold text-on-surface mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Action Plan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(report.action_plan)
              .filter(([, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === "string")
              .map(([period, items]: [string, any], idx: number) => {
              const colors = [
                "bg-primary-50",
                "bg-secondary-50",
                "bg-accent-50",
              ];
              const headerColors = ["text-primary", "text-secondary", "text-accent-600"];
              return (
                <div key={period} className={`rounded p-5 ${colors[idx % 3] || colors[0]}`}>
                  <h3 className={`font-heading font-semibold text-sm uppercase tracking-wide mb-3 ${headerColors[idx % 3] || headerColors[0]}`}>
                    {period.replace(/_/g, " ")}
                  </h3>
                  <ul className="space-y-2">
                    {items.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                        <svg className="w-4 h-4 text-on-surface-variant/40 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                        </svg>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Parent Section */}
      {report.parent_section && (
        <div className="sa-card">
          <h2 className="text-lg font-heading font-semibold text-on-surface mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Parent Section
            <span className="text-sm font-normal text-on-surface-variant/50 ml-1">(&#x0905;&#x092D;&#x093F;&#x092D;&#x093E;&#x0935;&#x0915;&#x094B;&#x0902; &#x0915;&#x0947; &#x0932;&#x093F;&#x090F;)</span>
          </h2>

          {report.parent_section.recommendation_summary && (
            <div className="rounded bg-surface-container-high p-4 mb-4">
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {report.parent_section.recommendation_summary}
              </p>
            </div>
          )}

          {report.parent_section.recommendation_summary_hi && (
            <div className="rounded bg-secondary-50 p-4 mb-4">
              <p className="text-sm text-on-surface-variant leading-relaxed" lang="hi">
                {report.parent_section.recommendation_summary_hi}
              </p>
            </div>
          )}

          {report.parent_section.what_to_do_now && (
            <div>
              <h3 className="font-heading font-medium text-sm text-on-surface mb-2">What to do now:</h3>
              <ul className="space-y-2">
                {(report.parent_section.what_to_do_now || []).map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 text-primary text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.parent_section.what_to_do_now_hi && (
            <div className="mt-4 pt-4 border-t border-surface-container-high">
              <h3 className="font-heading font-medium text-sm text-on-surface mb-2" lang="hi">&#x0905;&#x092C; &#x0915;&#x094D;&#x092F;&#x093E; &#x0915;&#x0930;&#x0947;&#x0902;:</h3>
              <ul className="space-y-2">
                {(report.parent_section.what_to_do_now_hi || []).map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant" lang="hi">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary-50 text-secondary text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
