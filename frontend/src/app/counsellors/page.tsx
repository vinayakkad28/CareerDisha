"use client";

import { useCallback, useEffect, useState } from "react";
import { counsellors as counsellorsApi } from "@/lib/api";

/**
 * Counsellor assignments and commission tracking.
 *
 * Nine endpoints have existed with no UI. This is the view that makes scaling
 * through associates possible: who is assigned to which school, and what they
 * are owed per session.
 */
export default function CounsellorsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, c] = await Promise.all([
        counsellorsApi.assignments(),
        counsellorsApi.commissions(),
      ]);
      setAssignments(Array.isArray(a) ? a : (a as any)?.assignments || []);
      setCommissions(Array.isArray(c) ? c : (c as any)?.commissions || []);
    } catch (e: any) {
      setError(e?.message || "Could not load counsellor data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalOwed = commissions
    .filter((c) => c.status !== "paid")
    .reduce((sum, c) => sum + (Number(c.amount_inr) || 0), 0);

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-10 flex justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-8 text-center space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={load} className="btn-primary px-6 py-2 text-sm font-bold">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-primary font-heading">Counsellors</h1>
          <p className="text-sm text-slate-500 mt-1">School assignments and commission payouts.</p>
        </div>
        {commissions.length > 0 && (
          <div className="text-right">
            <p className="text-xs uppercase font-bold text-slate-500">Outstanding</p>
            <p className="text-2xl font-extrabold text-primary font-heading tabular-nums">
              ₹{totalOwed.toLocaleString("en-IN")}
            </p>
          </div>
        )}
      </header>

      <section className="bg-white rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-extrabold text-primary font-heading">
            School assignments ({assignments.length})
          </h2>
        </div>
        {assignments.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500 text-center">
            No counsellors assigned to schools yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-6 py-3">Counsellor</th>
                  <th className="text-left px-6 py-3">School</th>
                  <th className="text-left px-6 py-3">Commission</th>
                  <th className="text-left px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-6 py-3 font-bold text-slate-800">
                      {a.counsellor_name || a.counsellor_email || `#${a.counsellor_id}`}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{a.school_name || `#${a.school_id}`}</td>
                    <td className="px-6 py-3 text-slate-600 tabular-nums">
                      {a.commission_rate != null ? `${Math.round(a.commission_rate * 100)}%` : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${
                          a.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {a.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-extrabold text-primary font-heading">
            Commissions ({commissions.length})
          </h2>
        </div>
        {commissions.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500 text-center">
            No commissions calculated yet. They are generated per session once it is delivered.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-6 py-3">Counsellor</th>
                  <th className="text-left px-6 py-3">School</th>
                  <th className="text-left px-6 py-3">Students</th>
                  <th className="text-left px-6 py-3">Amount</th>
                  <th className="text-left px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-6 py-3 font-bold text-slate-800">
                      {c.counsellor_name || `#${c.counsellor_id}`}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{c.school_name || "—"}</td>
                    <td className="px-6 py-3 text-slate-600 tabular-nums">{c.students_count ?? "—"}</td>
                    <td className="px-6 py-3 font-bold text-slate-800 tabular-nums">
                      ₹{Number(c.amount_inr || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${
                          c.status === "paid"
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {c.status || "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
