"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RiasecRadarChart from "@/components/RiasecRadarChart";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const NAVY = "#1a5276";
const GOLD = "#d4ac0d";
const RIASEC_COLORS: Record<string, string> = {
  R: "#27ae60", I: "#2980b9", A: "#8e44ad",
  S: "#e67e22", E: "#c0392b", C: "#16a085",
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2
        className="text-lg font-bold mb-4 pb-2 border-b-2"
        style={{ color: NAVY, borderColor: GOLD }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${className || ""}`}>
      {children}
    </div>
  );
}

function TimelineItem({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ backgroundColor: GOLD }}
        />
        {label}
      </h4>
      <ul className="space-y-1 ml-4">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-700 flex gap-2">
            <span className="text-gray-300 shrink-0">·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
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
    fetch(`${API_BASE}/d2c/report/${token}`)
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
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-[#1a5276] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading report…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Report not available</h2>
          <p className="text-sm text-gray-500">
            {error === "Payment required"
              ? "This report requires payment. Please complete your purchase to view the full report."
              : error || "This report link is invalid or has expired."}
          </p>
          <a
            href="/assessment"
            className="inline-block mt-5 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: NAVY }}
          >
            Start New Assessment
          </a>
        </div>
      </div>
    );
  }

  const r = data.report;
  const holland = data.holland_code || "";
  const maxScore = Math.max(...Object.values(data.riasec_scores), 1);

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <header style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0d2b3e 100%)` }} className="text-white py-6 shadow-lg">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40 mb-1">CareerDisha — Career Assessment Report</p>
              <h1 className="text-2xl font-bold">{data.student_name}</h1>
              <p className="text-white/60 text-sm mt-1">Class {data.class_level}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40 mb-1">Holland Code</p>
              <div className="flex gap-1.5">
                {holland.split("").map((l, i) => (
                  <span
                    key={i}
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm"
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

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* RIASEC Profile */}
        <Section title="Your Interest Profile">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <RiasecRadarChart scores={data.riasec_scores} size={260} />
            </Card>
            <Card>
              <div className="space-y-3">
                {"RIASEC".split("").map((type) => {
                  const score = data.riasec_scores[type] || 0;
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-32 shrink-0">
                        <span
                          className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: RIASEC_COLORS[type] }}
                        >
                          {type}
                        </span>
                        <span className="text-xs text-gray-500">{RIASEC_NAMES[type]}</span>
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(score / maxScore) * 100}%`,
                            backgroundColor: RIASEC_COLORS[type],
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 w-10 text-right tabular-nums">
                        {score}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {r.riasec_analysis?.summary && (
            <Card className="mt-4">
              <p className="text-sm text-gray-700 leading-relaxed">{r.riasec_analysis.summary}</p>
              {r.riasec_analysis.primary_type_description && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
                    Primary Type — {RIASEC_NAMES[holland[0]] || holland[0]}
                  </p>
                  <p className="text-sm text-gray-700">{r.riasec_analysis.primary_type_description}</p>
                </div>
              )}
            </Card>
          )}
        </Section>

        {/* Stream Recommendation */}
        {r.stream_recommendation && (
          <Section title="Stream Recommendation">
            <Card>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-xl font-bold" style={{ color: NAVY }}>
                    {r.stream_recommendation.recommended_stream}
                  </h3>
                  {r.stream_recommendation.confidence && (
                    <span
                      className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-medium ${
                        r.stream_recommendation.confidence === "High"
                          ? "bg-green-100 text-green-700"
                          : r.stream_recommendation.confidence === "Medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      Confidence: {r.stream_recommendation.confidence}
                    </span>
                  )}
                </div>
                {r.stream_recommendation.alternative_stream && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Alternative</p>
                    <p className="text-sm font-medium text-gray-600">{r.stream_recommendation.alternative_stream}</p>
                  </div>
                )}
              </div>

              {r.stream_recommendation.reasoning && (
                <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                  {r.stream_recommendation.reasoning}
                </p>
              )}

              {r.stream_recommendation.why_this_stream && r.stream_recommendation.why_this_stream.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Why This Stream</p>
                  <ul className="space-y-1">
                    {r.stream_recommendation.why_this_stream.map((reason, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span style={{ color: GOLD }}>✓</span> {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.stream_recommendation.subject_combination && (
                <div className="mt-3 bg-blue-50 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Recommended Subjects</p>
                  <p className="text-sm text-blue-800">{r.stream_recommendation.subject_combination}</p>
                </div>
              )}
            </Card>
          </Section>
        )}

        {/* Career Matches */}
        {r.career_matches && r.career_matches.length > 0 && (
          <Section title="Career Matches">
            <div className="space-y-4">
              {r.career_matches.map((career, i) => (
                <Card key={i}>
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: i === 0 ? GOLD : NAVY }}
                    >
                      #{career.rank || i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="font-bold text-gray-900">{career.career_name}</h3>
                          {career.career_name_hindi && (
                            <p className="text-xs text-gray-400">{career.career_name_hindi}</p>
                          )}
                        </div>
                        {career.match_score && (
                          <span className="text-sm font-bold px-2 py-0.5 rounded-lg bg-green-50 text-green-700 shrink-0">
                            {career.match_score}% match
                          </span>
                        )}
                      </div>

                      {career.why_it_fits && (
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{career.why_it_fits}</p>
                      )}

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {career.salary_range && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Salary</p>
                            <p className="text-sm text-gray-700">{career.salary_range}</p>
                          </div>
                        )}
                        {career.growth_outlook && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Growth Outlook</p>
                            <p className="text-sm text-gray-700">{career.growth_outlook}</p>
                          </div>
                        )}
                      </div>

                      {career.education_pathway && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Education Pathway</p>
                          <p className="text-sm text-gray-700">{career.education_pathway}</p>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-3">
                        {career.entrance_exams && career.entrance_exams.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Entrance Exams</p>
                            <div className="flex flex-wrap gap-1">
                              {career.entrance_exams.map((e, j) => (
                                <span key={j} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                  {e}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {career.top_colleges && career.top_colleges.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Top Colleges</p>
                            <div className="flex flex-wrap gap-1">
                              {career.top_colleges.slice(0, 3).map((c, j) => (
                                <span key={j} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* Action Plan */}
        {r.action_plan && (
          <Section title="Action Plan">
            <Card>
              {r.action_plan.next_3_months && r.action_plan.next_3_months.length > 0 && (
                <TimelineItem label="Next 3 Months" items={r.action_plan.next_3_months} />
              )}
              {r.action_plan.next_1_year && r.action_plan.next_1_year.length > 0 && (
                <TimelineItem label="Next 1 Year" items={r.action_plan.next_1_year} />
              )}
              {r.action_plan.next_2_3_years && r.action_plan.next_2_3_years.length > 0 && (
                <TimelineItem label="2–3 Years Ahead" items={r.action_plan.next_2_3_years} />
              )}
            </Card>

            {(r.action_plan.recommended_books || r.action_plan.recommended_youtube || r.action_plan.recommended_websites) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                {r.action_plan.recommended_books && r.action_plan.recommended_books.length > 0 && (
                  <Card>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Books</p>
                    <ul className="space-y-1">
                      {r.action_plan.recommended_books.map((b, i) => (
                        <li key={i} className="text-xs text-gray-700 flex gap-1">
                          <span style={{ color: NAVY }}>📚</span> {b}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                {r.action_plan.recommended_youtube && r.action_plan.recommended_youtube.length > 0 && (
                  <Card>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">YouTube Channels</p>
                    <ul className="space-y-1">
                      {r.action_plan.recommended_youtube.map((y, i) => (
                        <li key={i} className="text-xs text-gray-700 flex gap-1">
                          <span>▶</span> {y}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                {r.action_plan.recommended_websites && r.action_plan.recommended_websites.length > 0 && (
                  <Card>
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Websites</p>
                    <ul className="space-y-1">
                      {r.action_plan.recommended_websites.map((w, i) => (
                        <li key={i} className="text-xs text-gray-700 flex gap-1">
                          <span style={{ color: GOLD }}>🔗</span> {w}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Personal Note */}
        {r.personal_note && (
          <Section title={`A Note for ${data.student_name.split(" ")[0]}`}>
            <Card>
              <div
                className="text-sm text-gray-700 leading-relaxed whitespace-pre-line italic border-l-4 pl-4"
                style={{ borderColor: GOLD }}
              >
                {r.personal_note}
              </div>
            </Card>
          </Section>
        )}

        {/* Parent Section */}
        {r.parent_section && (
          <Section title="For Parents / अभिभावकों के लिए">
            <Card>
              {r.parent_section.recommendation_summary && (
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  {r.parent_section.recommendation_summary}
                </p>
              )}
              {r.parent_section.recommendation_summary_hindi && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4 italic">
                  {r.parent_section.recommendation_summary_hindi}
                </p>
              )}

              {r.parent_section.what_to_do_now && r.parent_section.what_to_do_now.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">What To Do Now</p>
                  <ul className="space-y-1">
                    {r.parent_section.what_to_do_now.map((item, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span style={{ color: GOLD }}>✓</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.parent_section.faqs && r.parent_section.faqs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Common Questions</p>
                  <div className="space-y-3">
                    {r.parent_section.faqs.map((faq, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm font-semibold text-gray-800 mb-1">{faq.question_en}</p>
                        {faq.question_hi && (
                          <p className="text-xs text-gray-400 mb-1">{faq.question_hi}</p>
                        )}
                        <p className="text-sm text-gray-700">{faq.answer_en}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </Section>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8 border-t border-gray-200 mt-8">
          <p className="text-xs text-gray-400">
            CareerDisha — AI Career Counselling for Indian Students
          </p>
          <p className="text-xs text-gray-300 mt-1">
            This report is personal and confidential. Token: {token.slice(0, 8)}…
          </p>
          <a
            href={`${API_BASE}/d2c/pdf/${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: NAVY }}
          >
            Download PDF Report
          </a>
        </div>
      </div>
    </div>
  );
}
