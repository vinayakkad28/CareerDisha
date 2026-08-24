"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { students as studentsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState } from "@/components/UIStates";
import { useToast } from "@/components/Toast";
import RiasecRadarChart, { RiasecBarChart } from "@/components/RiasecRadarChart";
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
  const initials = student.name
    ? student.name.split(" ").map((n: string) => n.charAt(0).toUpperCase()).join("").slice(0, 2)
    : "S";

  return (
    <div className="max-w-admin mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <a className="hover:text-primary transition-colors" href="/sessions">Sessions</a>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <a className="hover:text-primary transition-colors" href={`/sessions/${student.session_id}`}>Session</a>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-primary font-semibold">{student.name}</span>
      </nav>

      {/* Header Section */}
      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-brand-gradient flex items-center justify-center text-white text-3xl font-heading font-bold shadow-lg ring-4 ring-white">
            {initials}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-heading font-extrabold text-primary">{student.name}</h1>
              {student.holland_code && (
                <span className="bg-secondary/10 text-secondary-600 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
                  {student.holland_code}
                </span>
              )}
            </div>
            <p className="text-slate-500 font-medium">
              Class {student.class_level}{student.section && `-${student.section}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRegenerate}
            className="px-6 py-2.5 rounded border-2 border-primary text-primary font-bold hover:bg-primary-50 transition-all active:scale-95"
          >
            Regenerate Report
          </button>
          {student.pdf_available && (
            <a
              href={studentsApi.downloadPdfURL(student.id)}
              className="px-6 py-2.5 rounded bg-brand-gradient text-white font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
              target="_blank"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </a>
          )}
        </div>
      </header>

      {/* Student Info Card */}
      <section className="bg-white rounded-lg p-8 mb-8 flex flex-wrap gap-x-12 gap-y-6 items-center shadow-sm">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Parent</span>
          <span className="font-semibold text-primary">{student.parent_name || "N/A"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Phone</span>
          <span className="font-mono text-primary">{student.parent_phone || "N/A"}</span>
        </div>
        <div className="h-10 w-px bg-surface-container-high hidden md:block" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Report Status</span>
          <StatusBadge status={student.report_status || "pending"} size="sm" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Delivery</span>
          <StatusBadge status={student.delivery_status || "pending"} size="sm" />
        </div>
      </section>

      {/* Grid Layout for Interest & Stream */}
      {hasScores && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Interest Profile Section */}
          <section className="lg:col-span-2 bg-white rounded-lg p-8 shadow-sm">
            <h2 className="text-xl font-heading font-bold text-primary mb-2">Interest Profile</h2>
            <div className="w-12 h-1 bg-secondary mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              {/* Radar Chart */}
              <div className="flex items-center justify-center">
                <RiasecRadarChart scores={scores} size={350} />
              </div>
              {/* Bar Chart */}
              <div className="flex flex-col justify-center">
                <RiasecBarChart scores={scores} />
              </div>
            </div>
          </section>

          {/* Stream Recommendation */}
          {report.stream_recommendation && (
            <section className="bg-white rounded-lg shadow-sm overflow-hidden border-l-8 border-primary flex flex-col">
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-lg font-heading font-bold text-primary">Stream Fit</h2>
                  {report.stream_recommendation.confidence && (
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                      {report.stream_recommendation.confidence >= 80 ? "High" : report.stream_recommendation.confidence >= 50 ? "Medium" : "Low"} Confidence
                    </span>
                  )}
                </div>
                <h3 className="text-4xl font-heading font-extrabold text-primary mb-4">
                  {report.stream_recommendation.recommended_stream}
                </h3>
                {report.stream_recommendation.reasoning && (
                  <p className="text-sm text-slate-600 leading-relaxed mb-6 italic">
                    {report.stream_recommendation.reasoning}
                  </p>
                )}
                {report.stream_recommendation.recommended_subjects && (
                  <div className="bg-[#D6EAF8]/30 p-4 rounded mb-6">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-2">Recommended Subjects</span>
                    <p className="text-primary font-semibold text-sm">
                      {Array.isArray(report.stream_recommendation.recommended_subjects)
                        ? report.stream_recommendation.recommended_subjects.join(", ")
                        : report.stream_recommendation.recommended_subjects}
                    </p>
                  </div>
                )}
              </div>
              {report.stream_recommendation.alternative_stream && (
                <div className="bg-surface-container-high p-6">
                  <span className="text-xs font-bold text-slate-400 block mb-1">Alternative Track</span>
                  <p className="text-sm text-slate-600 font-medium">{report.stream_recommendation.alternative_stream}</p>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Career Matches */}
      {report.career_matches && report.career_matches.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-heading font-bold text-primary mb-6">Top Career Matches</h2>
          <div className="space-y-4">
            {(report.career_matches || []).map((career: any, i: number) => (
              <div
                key={i}
                className={`bg-white rounded-lg p-6 shadow-sm group hover:bg-slate-50 transition-colors ${i > 0 ? `opacity-${100 - i * 10}` : ""}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-3 flex items-center gap-4">
                    <span className={`w-10 h-10 rounded flex items-center justify-center text-white font-black text-xl ${i === 0 ? "bg-secondary" : "bg-primary"}`}>
                      {career.rank || i + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-primary text-lg leading-tight">{career.career_name}</h4>
                      {career.career_name_hi && (
                        <span className="text-xs text-slate-400 font-medium">{career.career_name_hi}</span>
                      )}
                      {career.why_it_fits && (
                        <span className="text-xs text-slate-400 font-medium">{career.why_it_fits}</span>
                      )}
                    </div>
                  </div>
                  {career.match_score && (
                    <div className="md:col-span-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400">
                          <span>MATCH SCORE</span>
                          <span className="text-primary">{career.match_score}%</span>
                        </div>
                        <div className="w-full h-1 bg-surface-container-high rounded-full">
                          <div
                            className={`h-full rounded-full ${i === 0 ? "bg-secondary" : "bg-primary"}`}
                            style={{ width: `${career.match_score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className={`${career.match_score ? "md:col-span-7" : "md:col-span-9"} grid grid-cols-2 lg:grid-cols-4 gap-4`}>
                    {career.education_pathway && (
                      <div className="p-3 bg-surface-container-high rounded">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter block mb-1">Education</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-tight">{career.education_pathway}</p>
                      </div>
                    )}
                    {career.key_exams && (
                      <div className="p-3 bg-surface-container-high rounded">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter block mb-1">Key Exams</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-tight">
                          {Array.isArray(career.key_exams) ? career.key_exams.join(", ") : career.key_exams}
                        </p>
                      </div>
                    )}
                    {career.top_colleges && (
                      <div className="p-3 bg-surface-container-high rounded">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter block mb-1">Top Colleges</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-tight">
                          {Array.isArray(career.top_colleges) ? career.top_colleges.join(", ") : career.top_colleges}
                        </p>
                      </div>
                    )}
                    {career.salary_range && (
                      <div className="p-3 bg-surface-container-high rounded">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter block mb-1">Salary (Entry)</span>
                        <p className="text-[11px] font-bold text-slate-700 leading-tight">{career.salary_range}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Action Plan */}
      {report.action_plan && Object.keys(report.action_plan).length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-heading font-bold text-primary mb-6">Strategic Action Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(report.action_plan)
              .filter(([, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === "string")
              .map(([period, items]: [string, any], idx: number) => {
              const styles = [
                { bg: "bg-blue-50/50", border: "border-primary", headerColor: "text-primary", icon: "schedule" },
                { bg: "bg-amber-50/50", border: "border-secondary", headerColor: "text-secondary-600", icon: "rocket_launch" },
                { bg: "bg-green-50/50", border: "border-accent", headerColor: "text-accent-600", icon: "flag" },
              ];
              const style = styles[idx % 3];
              const iconColors = ["text-primary", "text-secondary-600", "text-accent-600"];
              return (
                <div key={period} className={`${style.bg} p-6 rounded-lg border-t-4 ${style.border} shadow-sm`}>
                  <h4 className={`font-heading font-extrabold ${style.headerColor} mb-4 flex items-center justify-between`}>
                    {period.replace(/_/g, " ")}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </h4>
                  <ul className="space-y-4 text-sm text-slate-700 font-medium">
                    {items.map((item: string, i: number) => (
                      <li key={i} className="flex gap-3">
                        <svg className={`w-5 h-5 flex-shrink-0 ${iconColors[idx % 3]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Parent Section */}
      {report.parent_section && (
        <section className="bg-primary text-white rounded-lg p-10 relative overflow-hidden">
          {/* Decorative background */}
          <div className="absolute right-0 top-0 h-full w-1/3 opacity-10 flex flex-wrap gap-4 pointer-events-none p-4">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </div>
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-2xl font-heading font-bold mb-2">
              For Parents / {"\u0905\u092D\u093F\u092D\u093E\u0935\u0915\u094B\u0902 \u0915\u0947 \u0932\u093F\u090F"}
            </h2>

            {report.parent_section.recommendation_summary && (
              <p className="text-blue-100 font-medium mb-4 leading-relaxed">
                {report.parent_section.recommendation_summary}
              </p>
            )}
            {report.parent_section.recommendation_summary_hi && (
              <p className="text-blue-100/80 font-medium mb-8 leading-relaxed text-sm" lang="hi">
                {report.parent_section.recommendation_summary_hi}
              </p>
            )}

            {report.parent_section.what_to_do_now && report.parent_section.what_to_do_now.length > 0 && (
              <>
                <h3 className="text-sm font-black uppercase tracking-widest text-secondary mb-4">
                  What to do now / {"\u0905\u092C \u0915\u094D\u092F\u093E \u0915\u0930\u0947\u0902?"}
                </h3>
                <div className="space-y-6">
                  {report.parent_section.what_to_do_now.map((item: string, i: number) => (
                    <div key={i} className="flex items-start gap-4">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-secondary flex items-center justify-center text-xs font-bold text-secondary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-sm">{item}</p>
                        {report.parent_section.what_to_do_now_hi?.[i] && (
                          <span className="block text-xs opacity-60 mt-1" lang="hi">
                            {report.parent_section.what_to_do_now_hi[i]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
