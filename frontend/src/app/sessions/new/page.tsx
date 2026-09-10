"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { schools as schoolsApi, sessions as sessionsApi } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";

export default function NewSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [schoolList, setSchoolList] = useState<any[]>([]);
  const [step, setStep] = useState<"create" | "upload">("create");
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [form, setForm] = useState({
    school_id: searchParams.get("school_id") || "",
    session_date: new Date().toISOString().split("T")[0],
    classes_assessed: [] as number[],
    counsellor_name: "",
    llm_provider: "",
    notes: "",
  });

  const [zipgradeFile, setZipgradeFile] = useState<File | null>(null);
  const [studentInfoFile, setStudentInfoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    schoolsApi.list().then(setSchoolList).catch(console.error);
  }, []);

  const toggleClass = (cls: number) => {
    setForm((f) => ({
      ...f,
      classes_assessed: f.classes_assessed.includes(cls)
        ? f.classes_assessed.filter((c) => c !== cls)
        : [...f.classes_assessed, cls].sort(),
    }));
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const session = await sessionsApi.create({
        school_id: Number(form.school_id),
        session_date: form.session_date,
        classes_assessed: form.classes_assessed,
        counsellor_name: form.counsellor_name,
        // Omitted when blank so the backend's configured default governs.
        // Sending "" would persist "" and break generation.
        ...(form.llm_provider ? { llm_provider: form.llm_provider } : {}),
        notes: form.notes,
      });
      setSessionId(session.id);
      setStep("upload");
      toast("Session created. Now upload the CSV files.", "success");
    } catch (err: any) {
      setError(err.message);
      toast(err.message || "Failed to create session", "error");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !zipgradeFile || !studentInfoFile) return;
    setUploading(true);
    setError("");
    try {
      const uploadResult = await sessionsApi.uploadCSVs(sessionId, zipgradeFile, studentInfoFile);
      if (uploadResult?.warnings && uploadResult.warnings.length > 0) {
        uploadResult.warnings.forEach((w: string) =>
          toast(w, "warning")
        );
      }
      toast("Files uploaded. Scoring students...", "info");
      await sessionsApi.score(sessionId);
      toast("Scoring complete!", "success");
      router.push(`/sessions/${sessionId}`);
    } catch (err: any) {
      setError(err.message);
      toast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-admin mx-auto">
      {/* Breadcrumb */}
      <header className="flex items-center gap-2 text-sm mb-8">
        <span className="text-slate-500">Sessions</span>
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[#1A5276] font-bold">Create New Session</span>
      </header>

      <h2 className="text-3xl font-bold text-[#1A5276] mb-8 font-heading">Create New Session</h2>

      <div className="grid grid-cols-1 gap-8">
        {/* Step 1: Session Details */}
        <section className={`max-w-form-narrow bg-white rounded-lg shadow-sm overflow-hidden ${step === "upload" ? "opacity-60" : ""}`}>
          <div className="p-6 border-b border-[#F0F2F5] flex justify-between items-center">
            <h3 className="text-lg font-bold text-[#1A5276]">Session Details</h3>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Step 1 of 2</span>
          </div>
          <div className="p-8">
            {step === "create" ? (
              <form onSubmit={handleCreateSession} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">School</label>
                  <div className="relative">
                    <select
                      value={form.school_id}
                      onChange={(e) => setForm({ ...form, school_id: e.target.value })}
                      className="w-full bg-[#F0F2F5] border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1A5276] transition-all appearance-none"
                      required
                    >
                      <option value="">Search and select school...</option>
                      {schoolList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.city})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Session Date</label>
                    <input
                      type="date"
                      value={form.session_date}
                      onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                      className="w-full bg-[#F0F2F5] border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1A5276] transition-all"
                      required
                    />
                  </div>
                  {user?.role === "admin" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">LLM Provider</label>
                      <select
                        value={form.llm_provider}
                        onChange={(e) => setForm({ ...form, llm_provider: e.target.value })}
                        className="w-full bg-[#F0F2F5] border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1A5276] transition-all"
                      >
                        <option value="">Server default (recommended)</option>
                        <option value="google">Google — Gemini Flash</option>
                        <option value="openai">OpenAI — GPT-4o mini</option>
                        <option value="anthropic">Anthropic — Claude Haiku</option>
                        <option value="groq">Groq — Llama 3.1 8B (too small, not recommended)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">Classes Assessed</label>
                  <div className="flex flex-wrap gap-2">
                    {[9, 10, 11, 12].map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleClass(cls)}
                        className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                          form.classes_assessed.includes(cls)
                            ? "bg-brand-gradient text-white shadow-md"
                            : "bg-[#F0F2F5] text-slate-600 hover:bg-[#e7e8e9]"
                        }`}
                      >
                        Class {cls}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Counsellor Name</label>
                  <input
                    value={form.counsellor_name}
                    onChange={(e) => setForm({ ...form, counsellor_name: e.target.value })}
                    className="w-full bg-[#F0F2F5] border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1A5276] transition-all"
                    placeholder="Enter counsellor name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full bg-[#F0F2F5] border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1A5276] transition-all"
                    placeholder="Any specific requirements for this session..."
                    rows={3}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-brand-gradient text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  Create Session &amp; Continue to Upload
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </form>
            ) : (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Session details saved
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Upload Student Data */}
        {step === "upload" && (
          <section className="max-w-form-narrow bg-white rounded-lg shadow-sm overflow-hidden border-t-4 border-accent">
            <div className="p-6 border-b border-[#F0F2F5] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#1A5276]">Upload Student Data</h3>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Step 2 of 2</span>
            </div>
            <div className="px-8 pt-8">
              {/* Success banner */}
              <div className="bg-accent/10 text-accent-600 p-4 rounded-lg flex items-center gap-3 mb-8">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-bold">Session created successfully (ID: #{sessionId})</span>
              </div>

              <form onSubmit={handleUpload}>
                <div className="grid grid-cols-2 gap-6 mb-8">
                  {/* ZipGrade Upload */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">ZipGrade CSV</label>
                    <label className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center group cursor-pointer transition-all bg-[#F8F9FA] ${
                      zipgradeFile ? "border-accent bg-accent/5" : "border-[#E7E8E9] hover:border-[#1A5276]"
                    }`}>
                      {zipgradeFile ? (
                        <>
                          <svg className="w-6 h-6 text-accent mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <p className="text-xs font-bold text-[#1A5276]">{zipgradeFile.name}</p>
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6 text-slate-400 mb-2 group-hover:text-[#1A5276]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-xs font-bold text-slate-700">Drag &amp; drop or click to upload</p>
                          <p className="text-[10px] text-slate-400 mt-2">Required: Q1-Q74, student name</p>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setZipgradeFile(e.target.files?.[0] || null)}
                        className="hidden"
                        required
                      />
                    </label>
                  </div>

                  {/* Student Info Upload */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">Student Info CSV</label>
                    <label className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center group cursor-pointer transition-all bg-[#F8F9FA] ${
                      studentInfoFile ? "border-accent bg-accent/5" : "border-[#E7E8E9] hover:border-[#1A5276]"
                    }`}>
                      {studentInfoFile ? (
                        <>
                          <svg className="w-6 h-6 text-accent mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <p className="text-xs font-bold text-[#1A5276]">{studentInfoFile.name}</p>
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6 text-slate-400 mb-2 group-hover:text-[#1A5276]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-xs font-bold text-slate-700">Drag &amp; drop or click to upload</p>
                          <p className="text-[10px] text-slate-400 mt-2">Contains: name, class, section, parent_name, phone</p>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setStudentInfoFile(e.target.files?.[0] || null)}
                        className="hidden"
                        required
                      />
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={uploading || !zipgradeFile || !studentInfoFile}
                  className="w-full py-4 bg-brand-gradient text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 mb-8 active:scale-[0.98] disabled:opacity-50"
                >
                  {uploading ? "Uploading & Scoring..." : "Upload & Score Students"}
                  {!uploading && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  )}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* Guidance Section */}
        <section className="max-w-form-narrow p-6 bg-[#D6EAF8] rounded-lg flex gap-4 items-start">
          <div className="p-2 bg-white rounded-full shadow-sm flex-shrink-0">
            <svg className="w-5 h-5 text-[#1A5276]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-[#1A5276] text-sm mb-1">Upload Requirements</h4>
            <p className="text-xs text-[#273944] leading-relaxed">
              Ensure the Student Info CSV headers exactly match our schema to enable accurate report generation.
              If you&apos;re using ZipGrade for assessment scoring, ensure student IDs are linked correctly in both sheets.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
