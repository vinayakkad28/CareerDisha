"use client";

import { useEffect, useState } from "react";
import { sessions as sessionsApi } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface CodeRow {
  code: string;
  times_used: number;
  max_uses: number;
  is_active: boolean;
  used_by: string;
}

/** Issue and reprint the codes students type to start the assessment.
 *
 * The code is what routes a submitted test into this session, so without one a
 * student's answers never reach this school's roster. Minting used to be
 * API-only, which meant the pilot could not actually be run from the app.
 */
export default function AccessCodePanel({ sessionId }: { sessionId: number }) {
  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [count, setCount] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const load = () => {
    sessionsApi
      .listAccessCodes(sessionId)
      .then((d) => setCodes(d.codes || []))
      .catch(() => setCodes([]));
  };

  useEffect(load, [sessionId]);

  const issue = async () => {
    setIssuing(true);
    try {
      // An empty count means "one per student on the roster", which is what the
      // API does with 0.
      const res = await sessionsApi.issueAccessCodes(sessionId, Number(count) || 0);
      toast(`${res.issued} codes issued`, "success");
      setCount("");
      setOpen(true);
      load();
    } catch (err: any) {
      toast(err.message || "Could not issue codes", "error");
    } finally {
      setIssuing(false);
    }
  };

  const copyAll = async () => {
    if (!codes?.length) return;
    try {
      await navigator.clipboard.writeText(codes.map((c) => c.code).join("\n"));
      toast("Codes copied", "success");
    } catch {
      toast("Could not copy — select the list and copy manually", "error");
    }
  };

  const unused = (codes || []).filter((c) => !c.times_used).length;

  return (
    <div className="bg-white p-6 rounded-lg space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M12.65 10A5.99 5.99 0 006 6a6 6 0 000 12 5.99 5.99 0 005.65-4H17v4h4v-4h2v-4H12.65zM6 14a2 2 0 110-4 2 2 0 010 4z"/></svg>
            <h3 className="font-bold text-primary font-heading">School Codes</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Students type one of these to start the assessment. It puts their answers
            on this session&apos;s roster and carries the consent from the signed circular.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="One per student"
            className="sa-input w-40 text-sm"
          />
          <button
            onClick={issue}
            disabled={issuing}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 whitespace-nowrap"
          >
            {issuing ? "Issuing…" : "Issue codes"}
          </button>
        </div>
      </div>

      {codes === null ? (
        <p className="text-xs text-slate-400">Loading codes…</p>
      ) : codes.length === 0 ? (
        <p className="text-xs text-slate-500">
          No codes yet. Issue them before the school visit and print them on the circular.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              <strong className="text-on-surface">{codes.length}</strong> issued ·{" "}
              <strong className="text-on-surface">{unused}</strong> still unused
            </span>
            <div className="flex gap-3">
              <button onClick={copyAll} className="font-bold text-primary hover:underline">
                Copy all
              </button>
              <button
                onClick={() => setOpen((v) => !v)}
                className="font-bold text-primary hover:underline"
              >
                {open ? "Hide" : "Show"} codes
              </button>
            </div>
          </div>

          {open && (
            <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-high sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Code</th>
                    <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Used by</th>
                    <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Uses</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.code} className="border-t border-slate-50">
                      <td className="px-4 py-2 font-mono font-bold tracking-widest text-primary">
                        {c.code}
                      </td>
                      <td className="px-4 py-2 text-on-surface-variant">
                        {c.used_by || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2 text-center text-xs text-slate-500">
                        {c.times_used}/{c.max_uses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
