"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RiasecRadarChart, { RiasecBarChart } from "@/components/RiasecRadarChart";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const RIASEC_COLORS: Record<string, string> = {
  R: "#e74c3c", I: "#3498db", A: "#9b59b6",
  S: "#2ecc71", E: "#e67e22", C: "#1abc9c",
};
const RIASEC_NAMES: Record<string, string> = {
  R: "Realistic", I: "Investigative", A: "Artistic",
  S: "Social", E: "Enterprising", C: "Conventional",
};

interface ReportData {
  token: string;
  student_name: string;
  class_level: number;
  holland_code: string;
  riasec_scores: Record<string, number>;
  report: {
    riasec_analysis?: {
      summary?: string;
      primary_type_description?: string;
      secondary_type_description?: string;
      tertiary_type_description?: string;
    };
    stream_recommendation?: {
      recommended_stream?: string;
      confidence?: string;
      reasoning?: string;
      subject_combination?: string;
      alternative_stream?: string;
      why_this_stream?: string[];
      what_if_change_mind?: string;
    };
    career_matches?: {
      rank: number;
      career_name: string;
      career_name_hindi?: string;
      match_score?: number;
      why_it_fits?: string;
      education_pathway?: string;
      entrance_exams?: string[];
      top_colleges?: string[];
      salary_range?: string;
      growth_outlook?: string;
    }[];
    action_plan?: {
      next_3_months?: string[];
      next_1_year?: string[];
      next_2_3_years?: string[];
      recommended_books?: string[];
      recommended_youtube?: string[];
      recommended_websites?: string[];
      skills_to_develop?: { skill: string; activity: string }[];
    };
    parent_section?: {
      recommendation_summary?: string;
      recommendation_summary_hindi?: string;
      what_to_do_now?: string[];
      faqs?: { question_en: string; question_hi?: string; answer_en: string; answer_hi?: string }[];
      conversation_starters?: string[];
    };
    personal_note?: string;
  };
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-lg font-bold text-primary mb-4">
      {children}
    </h2>
  );
}

export default function ReportPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/reports/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.detail || `Error ${r.status}`);
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-surface-container-high border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-on-surface-variant text-sm font-body">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v.01M12 9v3m0-9a9 9 0 110 18 9 9 0 010-18z" />
            </svg>
          </div>
          <h2 className="font-heading text-lg font-bold text-on-surface mb-2">Report not available</h2>
          <p className="text-sm text-on-surface-variant font-body">
            {error === "Payment required"
              ? "This report requires payment. Please complete your purchase to view the full report."
              : error || "This report link is invalid or has expired."}
          </p>
          <a href="/assessment" className="btn-primary mt-5 inline-flex">
            Start New Assessment
          </a>
        </div>
      </div>
    );
  }

  const r = data.report;
  const holland = data.holland_code || "";

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Header ── */}
      <header className="bg-brand-gradient text-white py-8">
        <div className="max-w-report mx-auto px-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40 mb-1 font-body">
                CareerDisha — Career Assessment Report
              </p>
              <h1 className="font-heading text-2xl font-bold">{data.student_name}</h1>
              <p className="text-white/60 text-sm mt-1 font-body">Class {data.class_level}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40 mb-2 font-body">Holland Code</p>
              <div className="flex gap-1.5">
                {holland.split("").map((l, i) => (
                  <span
                    key={i}
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-heading font-bold text-sm text-white"
                    style={{ backgroundColor: RIASEC_COLORS[l] || "#888" }}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-report mx-auto px-4 py-8 space-y-8">

        {/* ── Interest Profile ── */}
        <section>
          <SectionHeading>Your Interest Profile</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="sa-card flex items-center justify-center">
              <RiasecRadarChart scores={data.riasec_scores} size={260} />
            </div>
            <div className="sa-card flex items-center">
              <RiasecBarChart scores={data.riasec_scores} />
            </div>
          </div>

          {r.riasec_analysis?.summary && (
            <div className="sa-card mt-4">
              <p className="text-sm text-on-surface-variant leading-relaxed font-body">
                {r.riasec_analysis.summary}
              </p>
              {r.riasec_analysis.primary_type_description && (
                <div className="mt-4 pt-4 border-t border-surface-container-high">
                  <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-1">
                    Primary Type — {RIASEC_NAMES[holland[0]] || holland[0]}
                  </p>
                  <p className="text-sm text-on-surface font-body">
                    {r.riasec_analysis.primary_type_description}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Stream Recommendation ── */}
        {r.stream_recommendation && (
          <section>
            <SectionHeading>Stream Recommendation</SectionHeading>
            <div className="sa-card border-l-4 border-primary">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-heading text-xl font-bold text-primary">
                    {r.stream_recommendation.recommended_stream}
                  </h3>
                  {r.stream_recommendation.confidence && (
                    <span
                      className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-heading font-semibold ${
                        r.stream_recommendation.confidence === "High"
                          ? "bg-accent-50 text-accent-600"
                          : r.stream_recommendation.confidence === "Medium"
                          ? "bg-secondary-50 text-secondary-600"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      Confidence: {r.stream_recommendation.confidence}
                    </span>
                  )}
                </div>
                {r.stream_recommendation.alternative_stream && (
                  <div className="text-right">
                    <p className="text-xs text-on-surface-variant font-body">Alternative</p>
                    <p className="text-sm font-heading font-semibold text-on-surface">
                      {r.stream_recommendation.alternative_stream}
                    </p>
                  </div>
                )}
              </div>

              {r.stream_recommendation.reasoning && (
                <p className="mt-4 text-sm text-on-surface-variant leading-relaxed font-body">
                  {r.stream_recommendation.reasoning}
                </p>
              )}

              {r.stream_recommendation.why_this_stream && r.stream_recommendation.why_this_stream.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-2">
                    Why This Stream
                  </p>
                  <ul className="space-y-1.5">
                    {r.stream_recommendation.why_this_stream.map((reason, i) => (
                      <li key={i} className="text-sm text-on-surface font-body flex gap-2 items-start">
                        <span className="text-accent shrink-0 mt-0.5">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.stream_recommendation.subject_combination && (
                <div className="mt-4 bg-primary-50 rounded p-4">
                  <p className="text-xs font-heading font-semibold text-primary uppercase mb-1">
                    Recommended Subjects
                  </p>
                  <p className="text-sm text-primary-700 font-body">
                    {r.stream_recommendation.subject_combination}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Career Matches ── */}
        {r.career_matches && r.career_matches.length > 0 && (
          <section>
            <SectionHeading>Career Matches</SectionHeading>
            <div className="space-y-4">
              {r.career_matches.map((career, i) => (
                <div key={i} className="sa-card">
                  <div className="flex items-start gap-4">
                    {/* Rank badge */}
                    <div
                      className={`w-11 h-11 rounded-lg flex items-center justify-center font-heading font-bold text-sm text-white shrink-0 ${
                        i === 0 ? "bg-gold-gradient" : "bg-brand-gradient"
                      }`}
                    >
                      #{career.rank || i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="font-heading font-bold text-on-surface">
                            {career.career_name}
                          </h3>
                          {career.career_name_hindi && (
                            <p className="text-xs text-on-surface-variant font-body mt-0.5">
                              {career.career_name_hindi}
                            </p>
                          )}
                        </div>
                        {career.match_score && (
                          <span className="text-sm font-heading font-bold px-3 py-1 rounded-full bg-accent-50 text-accent-600 shrink-0">
                            {career.match_score}% match
                          </span>
                        )}
                      </div>

                      {career.why_it_fits && (
                        <p className="mt-3 text-sm text-on-surface-variant leading-relaxed font-body">
                          {career.why_it_fits}
                        </p>
                      )}

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {career.salary_range && (
                          <div className="bg-surface-container-high rounded p-3">
                            <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-1">
                              Salary
                            </p>
                            <p className="text-sm text-on-surface font-body">{career.salary_range}</p>
                          </div>
                        )}
                        {career.growth_outlook && (
                          <div className="bg-surface-container-high rounded p-3">
                            <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-1">
                              Growth Outlook
                            </p>
                            <p className="text-sm text-on-surface font-body">{career.growth_outlook}</p>
                          </div>
                        )}
                      </div>

                      {career.education_pathway && (
                        <div className="mt-3">
                          <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-1">
                            Education Pathway
                          </p>
                          <p className="text-sm text-on-surface font-body">{career.education_pathway}</p>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-4">
                        {career.entrance_exams && career.entrance_exams.length > 0 && (
                          <div>
                            <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-1.5">
                              Entrance Exams
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {career.entrance_exams.map((e, j) => (
                                <span
                                  key={j}
                                  className="text-xs bg-primary-50 text-primary-600 px-2.5 py-1 rounded-full font-body"
                                >
                                  {e}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {career.top_colleges && career.top_colleges.length > 0 && (
                          <div>
                            <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-1.5">
                              Top Colleges
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {career.top_colleges.slice(0, 3).map((c, j) => (
                                <span
                                  key={j}
                                  className="text-xs bg-accent-50 text-accent-600 px-2.5 py-1 rounded-full font-body"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Action Plan ── */}
        {r.action_plan && (
          <section>
            <SectionHeading>Action Plan</SectionHeading>

            {/* Time-period cards in a row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {r.action_plan.next_3_months && r.action_plan.next_3_months.length > 0 && (
                <div className="rounded p-5 bg-primary-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                    <h4 className="text-sm font-heading font-bold text-primary">Next 3 Months</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {r.action_plan.next_3_months.map((item, i) => (
                      <li key={i} className="text-xs text-primary-700 font-body flex gap-1.5 items-start">
                        <span className="text-primary mt-0.5 shrink-0">&#x2022;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {r.action_plan.next_1_year && r.action_plan.next_1_year.length > 0 && (
                <div className="rounded p-5 bg-secondary-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 rounded-full bg-secondary text-white flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <h4 className="text-sm font-heading font-bold text-secondary-600">Next 1 Year</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {r.action_plan.next_1_year.map((item, i) => (
                      <li key={i} className="text-xs text-secondary-600 font-body flex gap-1.5 items-start">
                        <span className="text-secondary mt-0.5 shrink-0">&#x2022;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {r.action_plan.next_2_3_years && r.action_plan.next_2_3_years.length > 0 && (
                <div className="rounded p-5 bg-accent-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <h4 className="text-sm font-heading font-bold text-accent-600">2-3 Years Ahead</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {r.action_plan.next_2_3_years.map((item, i) => (
                      <li key={i} className="text-xs text-accent-600 font-body flex gap-1.5 items-start">
                        <span className="text-accent mt-0.5 shrink-0">&#x2022;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Resources */}
            {(r.action_plan.recommended_books || r.action_plan.recommended_youtube || r.action_plan.recommended_websites) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                {r.action_plan.recommended_books && r.action_plan.recommended_books.length > 0 && (
                  <div className="sa-card">
                    <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-3">
                      Books
                    </p>
                    <ul className="space-y-1.5">
                      {r.action_plan.recommended_books.map((b, i) => (
                        <li key={i} className="text-xs text-on-surface font-body flex gap-1.5 items-start">
                          <span className="text-primary shrink-0">&#x25A0;</span> {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.action_plan.recommended_youtube && r.action_plan.recommended_youtube.length > 0 && (
                  <div className="sa-card">
                    <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-3">
                      YouTube Channels
                    </p>
                    <ul className="space-y-1.5">
                      {r.action_plan.recommended_youtube.map((y, i) => (
                        <li key={i} className="text-xs text-on-surface font-body flex gap-1.5 items-start">
                          <span className="text-secondary shrink-0">&#x25B6;</span> {y}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.action_plan.recommended_websites && r.action_plan.recommended_websites.length > 0 && (
                  <div className="sa-card">
                    <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-3">
                      Websites
                    </p>
                    <ul className="space-y-1.5">
                      {r.action_plan.recommended_websites.map((w, i) => (
                        <li key={i} className="text-xs text-on-surface font-body flex gap-1.5 items-start">
                          <span className="text-accent shrink-0">&#x2192;</span> {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Personal Note ── */}
        {r.personal_note && (
          <section>
            <SectionHeading>A Note for {data.student_name.split(" ")[0]}</SectionHeading>
            <div className="sa-card border-l-4 border-secondary">
              <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line italic font-body">
                {r.personal_note}
              </p>
            </div>
          </section>
        )}

        {/* ── Parent Section ── */}
        {r.parent_section && (
          <section>
            <SectionHeading>For Parents / &#x0905;&#x092D;&#x093F;&#x092D;&#x093E;&#x0935;&#x0915;&#x094B;&#x0902; &#x0915;&#x0947; &#x0932;&#x093F;&#x090F;</SectionHeading>
            <div className="sa-card">
              {r.parent_section.recommendation_summary && (
                <p className="text-sm text-on-surface leading-relaxed mb-4 font-body">
                  {r.parent_section.recommendation_summary}
                </p>
              )}
              {r.parent_section.recommendation_summary_hindi && (
                <p className="text-sm text-on-surface-variant leading-relaxed mb-5 italic font-body">
                  {r.parent_section.recommendation_summary_hindi}
                </p>
              )}

              {r.parent_section.what_to_do_now && r.parent_section.what_to_do_now.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-3">
                    What To Do Now
                  </p>
                  <ol className="space-y-2">
                    {r.parent_section.what_to_do_now.map((item, i) => (
                      <li key={i} className="text-sm text-on-surface font-body flex gap-3 items-start">
                        <span className="w-6 h-6 rounded-full bg-brand-gradient text-white flex items-center justify-center text-xs font-heading font-bold shrink-0">
                          {i + 1}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {r.parent_section.faqs && r.parent_section.faqs.length > 0 && (
                <div>
                  <p className="text-xs font-heading font-semibold text-on-surface-variant uppercase mb-3">
                    Common Questions
                  </p>
                  <div className="space-y-3">
                    {r.parent_section.faqs.map((faq, i) => (
                      <div key={i} className="bg-surface-container-high rounded p-4">
                        <p className="text-sm font-heading font-semibold text-on-surface mb-1">
                          {faq.question_en}
                        </p>
                        {faq.question_hi && (
                          <p className="text-xs text-on-surface-variant mb-2 font-body">{faq.question_hi}</p>
                        )}
                        <p className="text-sm text-on-surface font-body">{faq.answer_en}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <div className="text-center pt-6 pb-8 mt-8">
          <a
            href={`${API_BASE}/d2c/pdf/${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary px-8 py-3"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF Report
          </a>
          <p className="text-xs text-on-surface-variant mt-4 font-body">
            CareerDisha — AI Career Counselling for Indian Students
          </p>
          <p className="text-xs text-outline mt-1 font-body">
            This report is personal and confidential. Token: {token.slice(0, 8)}...
          </p>
        </div>
      </div>
    </div>
  );
}
