"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RiasecRadarChart from "@/components/RiasecRadarChart";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const RIASEC_COLORS: Record<string, string> = {
  R: "#e74c3c", I: "#3498db", A: "#9b59b6",
  S: "#2ecc71", E: "#e67e22", C: "#1abc9c",
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
    personality_portrait?: {
      who_you_are?: string;
      your_strengths?: string[];
      what_energizes_you?: string;
      natural_challenges?: string;
      your_future_self?: string;
    };
    career_deep_dive?: {
      career_name?: string;
      day_in_the_life?: string;
      why_this_fits_you_deeply?: string;
      the_honest_truth?: string;
      journey_map?: { stage: string; actions?: string[]; description?: string }[];
      salary_by_company_tier?: {
        tier1_mnc?: string;
        tier2_it?: string;
        startup?: string;
        government?: string;
      };
    };
    stream_comparison?: {
      all_streams?: {
        stream: string;
        fit: string;
        fit_reason?: string;
        opens?: string[];
        challenge_for_this_profile?: string;
      }[];
      decision_framework?: string;
    };
    hidden_gems?: {
      career_name: string;
      why_you_probably_never_considered_it?: string;
      what_it_actually_is?: string;
      why_it_fits_your_profile?: string;
      salary_snapshot?: string;
      first_step?: string;
    }[];
    financial_roadmap?: {
      education_cost?: {
        government_college?: string;
        private_college_mid?: string;
        private_college_top?: string;
      };
      earnings_timeline?: { period: string; ctc: string; note?: string }[];
      roi_simple?: string;
      top_scholarships?: { name: string; amount?: string; eligibility?: string; how_to_apply?: string }[];
      education_loan_guidance?: string;
    };
    confidence_builder?: {
      your_confidence_snapshot?: string;
      gap_analysis?: string;
      thirty_day_challenges?: { challenge: string; why: string }[];
      your_evidence?: string;
    };
  };
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

  /* Sort RIASEC scores descending for bar display */
  const sortedScores = Object.entries(data.riasec_scores)
    .sort(([, a], [, b]) => b - a);
  const maxScore = Math.max(...Object.values(data.riasec_scores), 1);

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <div className="max-w-report mx-auto bg-white shadow-2xl min-h-screen mb-20 overflow-hidden">

        {/* SECTION 1: HEADER */}
        <header className="bg-brand-gradient px-8 py-10 flex justify-between items-center text-white">
          <div>
            <h1 className="font-heading text-3xl font-extrabold tracking-tight">{data.student_name}</h1>
            <p className="font-body text-sm opacity-80 uppercase tracking-widest mt-1">
              Class {data.class_level}
            </p>
          </div>
          <div className="flex gap-3">
            {holland.split("").map((l, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-lg flex items-center justify-center font-heading font-bold text-lg text-white"
                style={{ backgroundColor: RIASEC_COLORS[l] || "#888" }}
              >
                {l}
              </div>
            ))}
          </div>
        </header>

        <main className="p-10 space-y-16">

          {/* PERSONALITY PORTRAIT */}
          {r.personality_portrait && (
            <section>
              <h2 className="font-heading text-2xl font-bold text-primary inline-block border-b-4 border-secondary pb-1 mb-8">
                Your Personality Portrait
              </h2>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line mb-8">
                {r.personality_portrait.who_you_are}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="font-heading text-lg font-bold text-primary mb-4">Your Natural Strengths</h3>
                  <ul className="space-y-3">
                    {r.personality_portrait.your_strengths?.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <span className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-4">
                  <div className="bg-blue-50/50 p-5 rounded-xl">
                    <h4 className="font-heading text-sm font-bold text-blue-900 mb-2">What Energizes You</h4>
                    <p className="text-sm text-blue-800 leading-relaxed">{r.personality_portrait.what_energizes_you}</p>
                  </div>
                  <div className="bg-amber-50/50 p-5 rounded-xl">
                    <h4 className="font-heading text-sm font-bold text-amber-900 mb-2">Areas to Develop</h4>
                    <p className="text-sm text-amber-800 leading-relaxed">{r.personality_portrait.natural_challenges}</p>
                  </div>
                </div>
              </div>
              {r.personality_portrait.your_future_self && (
                <div className="bg-brand-gradient text-white p-6 rounded-xl">
                  <h3 className="font-heading text-lg font-bold text-secondary mb-3">Your Future Self</h3>
                  <p className="text-sm leading-relaxed opacity-90">{r.personality_portrait.your_future_self}</p>
                </div>
              )}
            </section>
          )}

          {/* CONFIDENCE BUILDER */}
          {r.confidence_builder && (
            <section>
              <h2 className="font-heading text-2xl font-bold text-primary inline-block border-b-4 border-secondary pb-1 mb-8">
                Building Your Confidence
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">{r.confidence_builder.your_confidence_snapshot}</p>

              {r.confidence_builder.gap_analysis && (
                <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl mb-6">
                  <h3 className="font-heading text-sm font-bold text-amber-900 mb-2">Interest vs Confidence: Your Gaps</h3>
                  <p className="text-sm text-amber-800 leading-relaxed">{r.confidence_builder.gap_analysis}</p>
                </div>
              )}

              {r.confidence_builder.thirty_day_challenges && r.confidence_builder.thirty_day_challenges.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-heading text-lg font-bold text-primary mb-4">Your 30-Day Confidence Challenges</h3>
                  <div className="space-y-3">
                    {r.confidence_builder.thirty_day_challenges.map((ch, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 border border-surface-container-high rounded-xl">
                        <span className="w-8 h-8 rounded-full bg-brand-gradient text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{ch.challenge}</p>
                          <p className="text-xs text-slate-500 mt-1">{ch.why}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.confidence_builder.your_evidence && (
                <div className="bg-brand-gradient text-white p-6 rounded-xl">
                  <h3 className="font-heading text-lg font-bold text-secondary mb-3">The Evidence For You</h3>
                  <p className="text-sm leading-relaxed opacity-90">{r.confidence_builder.your_evidence}</p>
                </div>
              )}
            </section>
          )}

          {/* SECTION 2: INTEREST PROFILE */}
          <section>
            <h2 className="font-heading text-2xl font-bold text-primary inline-block border-b-4 border-secondary pb-1 mb-8">
              Your Interest Profile
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              {/* Radar Chart */}
              <div className="aspect-square bg-surface-container-high rounded-xl flex items-center justify-center relative p-8">
                <RiasecRadarChart scores={data.riasec_scores} size={280} />
              </div>
              {/* Bar Chart */}
              <div className="space-y-4">
                <div className="space-y-3">
                  {sortedScores.map(([key, score]) => {
                    const pct = Math.round((score / maxScore) * 100);
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span
                          className="w-8 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: RIASEC_COLORS[key] }}
                        >
                          {key}
                        </span>
                        <div className="flex-1 bg-surface-container-high h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: RIASEC_COLORS[key] }}
                          />
                        </div>
                        <span className="font-body text-xs font-bold w-8 text-right">{score}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {r.riasec_analysis?.summary && (
              <div className="mt-8 p-6 bg-surface-container-high rounded-lg italic text-slate-700 leading-relaxed border-l-4 border-primary">
                <p>{r.riasec_analysis.summary}</p>
              </div>
            )}
          </section>

          {/* STREAM COMPARISON MATRIX */}
          {r.stream_comparison?.all_streams && r.stream_comparison.all_streams.length > 0 && (
            <section>
              <h2 className="font-heading text-2xl font-bold text-primary inline-block border-b-4 border-secondary pb-1 mb-8">
                How Every Stream Fits Your Profile
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-brand-gradient text-white">
                      <th className="px-4 py-3 text-left font-heading font-bold">Stream</th>
                      <th className="px-4 py-3 text-center font-heading font-bold">Fit</th>
                      <th className="px-4 py-3 text-left font-heading font-bold">Why (Based on Your Scores)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.stream_comparison.all_streams.map((s, i) => (
                      <tr key={i} className={i % 2 === 1 ? "bg-surface-container-high/30" : ""}>
                        <td className="px-4 py-3 font-semibold text-primary">{s.stream}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                            s.fit === "Strong"
                              ? "bg-green-100 text-green-700"
                              : s.fit === "Moderate"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {s.fit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{s.fit_reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {r.stream_comparison.decision_framework && (
                <div className="mt-6 bg-amber-50 border-l-4 border-secondary p-5 rounded-r-xl">
                  <h4 className="font-heading text-sm font-bold text-slate-800 mb-2">How to Decide: 3 Questions</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{r.stream_comparison.decision_framework}</p>
                </div>
              )}
            </section>
          )}

          {/* SECTION 3: STREAM RECOMMENDATION */}
          {r.stream_recommendation && (
            <section>
              <div className="bg-white rounded-xl border-l-[12px] border-primary shadow-sm p-8 flex flex-col md:flex-row gap-8">
                <div className="md:w-1/2">
                  <span className="font-body text-xs font-bold tracking-widest text-slate-500 uppercase">Recommended Stream</span>
                  <div className="flex items-baseline gap-4 mt-2 mb-4">
                    <h3 className="font-heading text-4xl font-extrabold text-primary">
                      {r.stream_recommendation.recommended_stream}
                    </h3>
                    {r.stream_recommendation.confidence && (
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter ${
                        r.stream_recommendation.confidence === "High"
                          ? "bg-accent-50 text-accent-600"
                          : r.stream_recommendation.confidence === "Medium"
                          ? "bg-secondary-50 text-secondary-600"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}>
                        {r.stream_recommendation.confidence} Confidence
                      </span>
                    )}
                  </div>
                  {r.stream_recommendation.reasoning && (
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {r.stream_recommendation.reasoning}
                    </p>
                  )}
                </div>
                <div className="md:w-1/2 flex flex-col justify-between">
                  {r.stream_recommendation.why_this_stream && r.stream_recommendation.why_this_stream.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <h4 className="font-heading text-sm font-bold text-slate-800">Why This Stream:</h4>
                      <ul className="space-y-1">
                        {r.stream_recommendation.why_this_stream.map((reason, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                            <svg className="w-4 h-4 text-secondary shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.stream_recommendation.subject_combination && (
                    <div className="bg-primary-50 p-4 rounded-lg">
                      <span className="font-body text-[10px] font-bold text-primary uppercase tracking-wide">Key Subjects</span>
                      <p className="text-sm font-semibold text-primary mt-1">
                        {r.stream_recommendation.subject_combination}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* CAREER #1 DEEP DIVE */}
          {r.career_deep_dive && (
            <section>
              <h2 className="font-heading text-2xl font-bold text-primary inline-block border-b-4 border-secondary pb-1 mb-2">
                Deep Dive: {r.career_deep_dive.career_name}
              </h2>
              <p className="text-xs text-slate-400 mb-8">Your #1 career match — explored in full detail</p>

              {/* Day in the Life */}
              {r.career_deep_dive.day_in_the_life && (
                <div className="bg-blue-50/50 border-l-4 border-primary p-6 rounded-r-xl mb-6">
                  <h3 className="font-heading text-lg font-bold text-primary mb-3">A Day in the Life</h3>
                  <p className="text-sm text-slate-700 leading-relaxed italic">{r.career_deep_dive.day_in_the_life}</p>
                </div>
              )}

              {/* Why it fits */}
              {r.career_deep_dive.why_this_fits_you_deeply && (
                <div className="mb-6">
                  <h3 className="font-heading text-lg font-bold text-primary mb-3">Why This Career Fits Your Profile Specifically</h3>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{r.career_deep_dive.why_this_fits_you_deeply}</p>
                </div>
              )}

              {/* The Honest Truth */}
              {r.career_deep_dive.the_honest_truth && (
                <div className="bg-orange-50 border border-orange-200 p-5 rounded-xl mb-6">
                  <h3 className="font-heading text-lg font-bold text-orange-700 mb-3">The Honest Truth</h3>
                  <p className="text-sm text-orange-900 leading-relaxed">{r.career_deep_dive.the_honest_truth}</p>
                </div>
              )}

              {/* Salary by company tier */}
              {r.career_deep_dive.salary_by_company_tier && (
                <div className="mb-6">
                  <h3 className="font-heading text-lg font-bold text-primary mb-4">Salary Reality in India (2025)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: "Tier 1 MNC (Google, Amazon, Microsoft)", value: r.career_deep_dive.salary_by_company_tier.tier1_mnc, color: "text-green-600" },
                      { label: "Tier 2 IT (TCS, Infosys, Wipro)", value: r.career_deep_dive.salary_by_company_tier.tier2_it, color: "text-slate-700" },
                      { label: "Funded Startup", value: r.career_deep_dive.salary_by_company_tier.startup, color: "text-slate-700" },
                      { label: "Government / PSU", value: r.career_deep_dive.salary_by_company_tier.government, color: "text-slate-700" },
                    ].map((tier, i) => tier.value && (
                      <div key={i} className="flex justify-between items-center p-3 bg-surface-container-high rounded-lg">
                        <span className="text-xs text-slate-500">{tier.label}</span>
                        <span className={`text-sm font-bold ${tier.color}`}>{tier.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Journey Map */}
              {r.career_deep_dive.journey_map && r.career_deep_dive.journey_map.length > 0 && (
                <div>
                  <h3 className="font-heading text-lg font-bold text-primary mb-4">
                    Your Journey to Becoming a {r.career_deep_dive.career_name}
                  </h3>
                  <div className="space-y-4">
                    {r.career_deep_dive.journey_map.map((stage, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="w-36 shrink-0 bg-brand-gradient text-white text-center py-2 px-3 rounded-lg text-xs font-bold">
                          {stage.stage}
                        </div>
                        <div className="flex-1 border-l-2 border-secondary pl-4">
                          {stage.actions ? (
                            <ul className="text-sm text-slate-600 space-y-1">
                              {stage.actions.map((a, j) => (
                                <li key={j}>&#x2022; {a}</li>
                              ))}
                            </ul>
                          ) : stage.description ? (
                            <p className="text-sm text-slate-600">{stage.description}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SECTION 4: TOP CAREER MATCHES */}
          {r.career_matches && r.career_matches.length > 0 && (
            <section>
              <h2 className="font-heading text-2xl font-bold text-primary mb-10">Your Top Career Matches</h2>
              <div className="space-y-8">
                {r.career_matches.map((career, i) => (
                  <div
                    key={i}
                    className={`bg-white rounded-xl p-8 flex flex-col md:flex-row gap-8 items-start relative overflow-hidden ${
                      i > 0 ? "opacity-90 hover:opacity-100 transition-opacity" : ""
                    }`}
                  >
                    {i === 0 && (
                      <div className="absolute top-0 right-0 bg-secondary text-white px-4 py-1 text-[10px] font-bold uppercase tracking-widest">
                        Primary Match
                      </div>
                    )}
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-white font-heading text-2xl font-black ${
                        i === 0 ? "bg-gold-gradient" : "bg-brand-gradient"
                      }`}
                    >
                      {career.rank || i + 1}
                    </div>
                    <div className="flex-1 space-y-6">
                      <div>
                        <h3 className="font-heading text-2xl font-bold text-primary flex items-center gap-3">
                          {career.career_name}
                          {career.career_name_hindi && (
                            <span className="text-lg font-normal text-slate-400">
                              {career.career_name_hindi}
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          {career.match_score && (
                            <span className="text-sm font-bold text-accent-600">{career.match_score}% Match</span>
                          )}
                          {career.match_score && career.why_it_fits && (
                            <span className="text-slate-300">&bull;</span>
                          )}
                          {career.why_it_fits && (
                            <span className="text-xs text-slate-500">Why it fits: {career.why_it_fits}</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {career.salary_range && (
                          <div className="bg-surface-container-high p-3 rounded text-center">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold">Avg Salary</span>
                            <span className="text-sm font-bold text-primary">{career.salary_range}</span>
                          </div>
                        )}
                        {career.growth_outlook && (
                          <div className="bg-surface-container-high p-3 rounded text-center">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold">Growth</span>
                            <span className="text-sm font-bold text-primary">{career.growth_outlook}</span>
                          </div>
                        )}
                        {career.education_pathway && (
                          <div className="bg-surface-container-high p-3 rounded text-center">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold">Education</span>
                            <span className="text-sm font-bold text-primary">{career.education_pathway}</span>
                          </div>
                        )}
                        {career.entrance_exams && career.entrance_exams.length > 0 && (
                          <div className="bg-surface-container-high p-3 rounded text-center">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold">Entrance</span>
                            <span className="text-sm font-bold text-primary">{career.entrance_exams.join("/")}</span>
                          </div>
                        )}
                      </div>

                      {career.top_colleges && career.top_colleges.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {career.top_colleges.slice(0, 4).map((c, j) => (
                            <span key={j} className="px-3 py-1 bg-surface-container-highest rounded text-[10px] font-bold text-slate-600">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* HIDDEN GEMS */}
          {r.hidden_gems && r.hidden_gems.length > 0 && (
            <section>
              <h2 className="font-heading text-2xl font-bold text-primary inline-block border-b-4 border-secondary pb-1 mb-4">
                Careers You&apos;ve Probably Never Considered
              </h2>
              <p className="text-sm text-slate-500 mb-8">
                Most students with your profile think of a handful of obvious paths. These lesser-known careers match your interests just as strongly.
              </p>
              <div className="space-y-4">
                {r.hidden_gems.map((gem, i) => (
                  <div key={i} className="border-2 border-secondary/40 rounded-xl p-6 bg-amber-50/20">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-8 h-8 rounded-full bg-secondary text-primary flex items-center justify-center font-bold text-sm">&#10022;</span>
                      <h3 className="font-heading text-xl font-bold text-primary">{gem.career_name}</h3>
                    </div>
                    {gem.why_you_probably_never_considered_it && (
                      <p className="text-xs text-slate-400 italic mb-3">{gem.why_you_probably_never_considered_it}</p>
                    )}
                    {gem.what_it_actually_is && (
                      <p className="text-sm text-slate-600 mb-2"><span className="font-semibold">What it is:</span> {gem.what_it_actually_is}</p>
                    )}
                    {gem.why_it_fits_your_profile && (
                      <p className="text-sm text-slate-600 mb-3"><span className="font-semibold">Why it fits you:</span> {gem.why_it_fits_your_profile}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs">
                      {gem.salary_snapshot && (
                        <span className="text-green-600 font-semibold">{gem.salary_snapshot}</span>
                      )}
                      {gem.first_step && (
                        <span className="text-primary border-l border-slate-200 pl-4"><span className="font-semibold">Start here:</span> {gem.first_step}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 5: ACTION PLAN */}
          {r.action_plan && (
            <section>
              <h2 className="font-heading text-2xl font-bold text-primary mb-10">Your Action Plan</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {r.action_plan.next_3_months && r.action_plan.next_3_months.length > 0 && (
                  <div className="bg-blue-50/50 p-6 rounded-xl space-y-4">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <h4 className="font-heading font-bold text-blue-900">Next 3 Months</h4>
                    </div>
                    <ul className="text-xs text-blue-800 space-y-3 leading-relaxed">
                      {r.action_plan.next_3_months.map((item, i) => (
                        <li key={i}>&#x2022; {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.action_plan.next_1_year && r.action_plan.next_1_year.length > 0 && (
                  <div className="bg-amber-50/50 p-6 rounded-xl space-y-4">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <h4 className="font-heading font-bold text-amber-900">Next 1 Year</h4>
                    </div>
                    <ul className="text-xs text-amber-800 space-y-3 leading-relaxed">
                      {r.action_plan.next_1_year.map((item, i) => (
                        <li key={i}>&#x2022; {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.action_plan.next_2_3_years && r.action_plan.next_2_3_years.length > 0 && (
                  <div className="bg-green-50/50 p-6 rounded-xl space-y-4">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <h4 className="font-heading font-bold text-green-900">2-3 Years</h4>
                    </div>
                    <ul className="text-xs text-green-800 space-y-3 leading-relaxed">
                      {r.action_plan.next_2_3_years.map((item, i) => (
                        <li key={i}>&#x2022; {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Resources row */}
              {(r.action_plan.recommended_books || r.action_plan.recommended_youtube || r.action_plan.recommended_websites) && (
                <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {r.action_plan.recommended_books && r.action_plan.recommended_books.length > 0 && (
                    <div className="p-4 border border-surface-container-high rounded-lg">
                      <span className="font-body text-[10px] text-slate-400 font-bold uppercase block mb-3">Recommended Books</span>
                      <div className="text-sm font-semibold text-primary">
                        {r.action_plan.recommended_books.map((b, i) => (
                          <span key={i}>{i > 0 && " | "}{b}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {r.action_plan.recommended_youtube && r.action_plan.recommended_youtube.length > 0 && (
                    <div className="p-4 border border-surface-container-high rounded-lg">
                      <span className="font-body text-[10px] text-slate-400 font-bold uppercase block mb-3">YouTube Channels</span>
                      <div className="text-sm font-semibold text-primary">
                        {r.action_plan.recommended_youtube.map((y, i) => (
                          <span key={i}>{i > 0 && " \u2022 "}{y}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {r.action_plan.recommended_websites && r.action_plan.recommended_websites.length > 0 && (
                    <div className="p-4 border border-surface-container-high rounded-lg">
                      <span className="font-body text-[10px] text-slate-400 font-bold uppercase block mb-3">Websites</span>
                      <div className="text-sm font-semibold text-primary">
                        {r.action_plan.recommended_websites.map((w, i) => (
                          <span key={i}>{i > 0 && " \u2022 "}{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* FINANCIAL ROADMAP */}
          {r.financial_roadmap && (
            <section>
              <h2 className="font-heading text-2xl font-bold text-primary inline-block border-b-4 border-secondary pb-1 mb-2">
                Your Financial Roadmap
              </h2>
              <p className="text-xs text-slate-400 mb-8">Based on your top career match — specific to India, 2025 data</p>

              {/* Education Cost */}
              {r.financial_roadmap.education_cost && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {r.financial_roadmap.education_cost.government_college && (
                    <div className="bg-green-50 rounded-xl p-5 text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Government College</p>
                      <p className="text-xl font-extrabold text-green-600">{r.financial_roadmap.education_cost.government_college}</p>
                    </div>
                  )}
                  {r.financial_roadmap.education_cost.private_college_mid && (
                    <div className="bg-amber-50 rounded-xl p-5 text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Mid-tier Private</p>
                      <p className="text-xl font-extrabold text-amber-600">{r.financial_roadmap.education_cost.private_college_mid}</p>
                    </div>
                  )}
                  {r.financial_roadmap.education_cost.private_college_top && (
                    <div className="bg-red-50 rounded-xl p-5 text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Top Private</p>
                      <p className="text-xl font-extrabold text-red-500">{r.financial_roadmap.education_cost.private_college_top}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ROI */}
              {r.financial_roadmap.roi_simple && (
                <div className="bg-brand-gradient text-white p-6 rounded-xl mb-6">
                  <h3 className="font-heading text-lg font-bold text-secondary mb-3">Return on Investment</h3>
                  <p className="text-sm leading-relaxed opacity-90">{r.financial_roadmap.roi_simple}</p>
                </div>
              )}

              {/* Earnings Timeline */}
              {r.financial_roadmap.earnings_timeline && r.financial_roadmap.earnings_timeline.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-heading text-lg font-bold text-primary mb-4">Your Earnings Trajectory</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-brand-gradient text-white">
                          <th className="px-4 py-3 text-left font-heading font-bold">Stage</th>
                          <th className="px-4 py-3 text-left font-heading font-bold">Expected CTC</th>
                          <th className="px-4 py-3 text-left font-heading font-bold">Context</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.financial_roadmap.earnings_timeline.map((row, i) => (
                          <tr key={i} className={i % 2 === 1 ? "bg-surface-container-high/30" : ""}>
                            <td className="px-4 py-3 font-semibold text-slate-700">{row.period}</td>
                            <td className="px-4 py-3 font-bold text-green-600">{row.ctc}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{row.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Scholarships */}
              {r.financial_roadmap.top_scholarships && r.financial_roadmap.top_scholarships.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-heading text-lg font-bold text-primary mb-4">Scholarships to Apply For</h3>
                  <div className="space-y-3">
                    {r.financial_roadmap.top_scholarships.map((sch, i) => (
                      <div key={i} className="border-l-4 border-green-500 bg-green-50/30 p-4 rounded-r-lg">
                        <p className="font-semibold text-green-700 text-sm">{sch.name}{sch.amount && ` — ${sch.amount}`}</p>
                        {sch.eligibility && <p className="text-xs text-slate-600 mt-1"><span className="font-semibold">Eligibility:</span> {sch.eligibility}</p>}
                        {sch.how_to_apply && <p className="text-xs text-slate-600"><span className="font-semibold">Apply at:</span> {sch.how_to_apply}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education Loan */}
              {r.financial_roadmap.education_loan_guidance && (
                <div className="bg-surface-container-high p-5 rounded-xl">
                  <h4 className="font-heading text-sm font-bold text-slate-800 mb-2">Education Loan Guidance</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{r.financial_roadmap.education_loan_guidance}</p>
                </div>
              )}
            </section>
          )}

          {/* SECTION 6: PERSONAL NOTE */}
          {r.personal_note && (
            <section className="py-10 border-y border-surface-container-high">
              <h2 className="font-heading text-xl font-bold text-primary mb-6 italic">
                A Note for {data.student_name.split(" ")[0]}
              </h2>
              <blockquote className="border-l-8 border-secondary pl-8 py-4 italic text-slate-700 leading-loose">
                &ldquo;{r.personal_note}&rdquo;
              </blockquote>
            </section>
          )}

          {/* SECTION 7: FOR PARENTS */}
          {r.parent_section && (
            <section className="bg-surface-container-high/50 p-8 rounded-2xl">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-primary">For Parents</h2>
                  <h3 className="text-lg text-slate-500">&#x0905;&#x092D;&#x093F;&#x092D;&#x093E;&#x0935;&#x0915;&#x094B;&#x0902; &#x0915;&#x0947; &#x0932;&#x093F;&#x090F;</h3>
                </div>
                <svg className="w-10 h-10 text-primary/20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A2.01 2.01 0 0018.06 7h-.12a2 2 0 00-1.9 1.37l-.86 2.58c1.08.6 1.82 1.73 1.82 3.05v8h3zm-7.5-10.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S11 9.17 11 10s.67 1.5 1.5 1.5zM5.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm2 16v-7H9V9c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v6h1.5v7h3zm6.5 0v-4h1V14c0-.83-.68-1.5-1.5-1.5h-2c-.83 0-1.5.67-1.5 1.5v4h1v4h3z" />
                </svg>
              </div>

              {r.parent_section.recommendation_summary && (
                <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                  {r.parent_section.recommendation_summary}
                </p>
              )}
              {r.parent_section.recommendation_summary_hindi && (
                <p className="text-sm text-slate-600 mb-8 leading-relaxed italic">
                  {r.parent_section.recommendation_summary_hindi}
                </p>
              )}

              {r.parent_section.what_to_do_now && r.parent_section.what_to_do_now.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-body text-xs font-bold uppercase tracking-wider text-primary">What to do now</h4>
                  <div className="space-y-3">
                    {r.parent_section.what_to_do_now.map((item, i) => (
                      <div key={i} className="flex gap-4 items-center bg-white p-3 rounded-lg">
                        <span className="w-8 h-8 rounded-full bg-brand-gradient text-white flex items-center justify-center font-bold text-sm">
                          {i + 1}
                        </span>
                        <span className="text-sm text-slate-700 font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.parent_section.faqs && r.parent_section.faqs.length > 0 && (
                <div className="mt-8 space-y-2">
                  {r.parent_section.faqs.map((faq, i) => (
                    <div key={i} className="bg-white/50 p-4 rounded-lg flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-700">{faq.question_en}</span>
                      <svg className="w-5 h-5 text-slate-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>

        {/* FOOTER */}
        <footer className="p-10 bg-surface-container-high flex flex-col items-center text-center gap-6">
          <a
            href={`${API_BASE}/d2c/pdf/${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand-gradient text-white px-10 py-4 rounded-full font-heading font-bold text-sm shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF Report
          </a>
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">
              Confidential Career Diagnostic Report
            </p>
            <code className="text-[10px] bg-white px-2 py-1 rounded text-slate-400 border border-slate-200">
              TOKEN: {token.slice(0, 16)}...
            </code>
          </div>
          <p className="font-body text-[10px] text-slate-400">
            CareerDisha. Institutional Grade Career Assessment.
          </p>
        </footer>
      </div>
    </div>
  );
}
