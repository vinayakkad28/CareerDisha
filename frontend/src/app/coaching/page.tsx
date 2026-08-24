"use client";

import { useCallback, useEffect, useState } from "react";
import { coaching as coachingApi } from "@/lib/api";

/**
 * Coaching options comparison.
 *
 * The backend has served this data since March with nothing in the UI reaching
 * it, while the paid assessment collects a `coaching_affordability` answer these
 * endpoints were built to act on. It is meant to be opened during a school
 * session or a parent conversation, so it leads with the honest answer —
 * self-study is viable for many exams — rather than with the paid options.
 */

interface Partner {
  id: string;
  name: string;
  name_hi?: string;
  type: string;
  programs?: string[];
  locations?: string[];
  fee_range_lakh?: string;
  website?: string;
  rating?: number;
  has_referral: boolean;
}

const BUDGETS = [
  { value: "", label: "Any budget" },
  { value: "low", label: "Low — online only" },
  { value: "high", label: "Higher — classroom or hybrid" },
];

export default function CoachingPage() {
  const [exams, setExams] = useState<string[]>([]);
  const [exam, setExam] = useState("");
  const [budget, setBudget] = useState("");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [note, setNote] = useState("");
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    coachingApi
      .partners()
      .then((d) => {
        setExams(d.exams || []);
        setExam((d.exams || [])[0] || "");
      })
      .catch(() => setError("Could not load coaching data."))
      .finally(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!exam) return;
    setLoading(true);
    setError("");
    try {
      const [rec, cmp] = await Promise.all([
        coachingApi.recommend(exam, budget),
        coachingApi.compare(exam),
      ]);
      setPartners(rec.partners || []);
      setNote(rec.note || "");
      setComparison(cmp);
    } catch {
      setError("Could not load options for this exam.");
    } finally {
      setLoading(false);
    }
  }, [exam, budget]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-primary font-heading">Coaching options</h1>
        <p className="text-sm text-slate-500 mt-1">
          For parent conversations about entrance-exam preparation.
        </p>
      </header>

      <div className="bg-white rounded-lg p-6 flex flex-wrap gap-4 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-slate-500">Exam</span>
          <select
            value={exam}
            onChange={(e) => setExam(e.target.value)}
            className="sa-input min-w-[200px]"
          >
            {exams.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-slate-500">Family budget</span>
          <select
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="sa-input min-w-[220px]"
          >
            {BUDGETS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="bg-white rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={load} className="btn-primary px-6 py-2 text-sm font-bold">
            Try again
          </button>
        </div>
      )}

      {loading && !error && (
        <div className="bg-white rounded-lg p-10 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!loading && !error && comparison && (
        <section className="bg-white rounded-lg p-6 space-y-4">
          <h2 className="font-extrabold text-primary font-heading">Coaching vs self-study</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(comparison.options || {}).map(([key, opt]: [string, any]) => (
              <div key={key} className="border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-baseline gap-2">
                  <h3 className="font-bold text-slate-800 capitalize">{key.replace(/_/g, " ")}</h3>
                  <span className="text-sm font-bold text-primary">{opt.cost}</span>
                </div>
                {opt.best_for && (
                  <p className="text-xs text-slate-500">Best for: {opt.best_for}</p>
                )}
                {opt.pros?.length > 0 && (
                  <ul className="text-sm text-slate-600 list-disc list-inside">
                    {opt.pros.map((x: string, i: number) => <li key={i}>{x}</li>)}
                  </ul>
                )}
                {opt.cons?.length > 0 && (
                  <ul className="text-sm text-slate-400 list-disc list-inside">
                    {opt.cons.map((x: string, i: number) => <li key={i}>{x}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && (
        <section className="bg-white rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-extrabold text-primary font-heading">
              Providers for {exam} ({partners.length})
            </h2>
          </div>
          {partners.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-500 text-center">
              No providers listed for this exam and budget.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-6 py-3">Provider</th>
                    <th className="text-left px-6 py-3">Mode</th>
                    <th className="text-left px-6 py-3">Fees (lakh)</th>
                    <th className="text-left px-6 py-3">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-6 py-3">
                        <span className="font-bold text-slate-800">{p.name}</span>
                        {p.website && (
                          <a
                            href={p.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-primary hover:underline"
                          >
                            {p.website.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-3 capitalize text-slate-600">{p.type}</td>
                      <td className="px-6 py-3 text-slate-600">{p.fee_range_lakh || "—"}</td>
                      <td className="px-6 py-3 text-slate-600">{p.rating ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {note && <p className="px-6 py-4 text-xs text-slate-500 border-t border-slate-100">{note}</p>}
          <p className="px-6 pb-4 text-xs text-slate-400">
            CareerNeeti has no referral arrangement with any provider listed here.
            Fees are indicative and should be confirmed with the institute.
          </p>
        </section>
      )}
    </div>
  );
}
