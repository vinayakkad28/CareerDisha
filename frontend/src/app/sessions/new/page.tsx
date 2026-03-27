"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { schools as schoolsApi, sessions as sessionsApi } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";

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
    llm_provider: "groq",
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
        llm_provider: form.llm_provider,
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
      // Auto-score after upload
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
    <div className="space-y-6">
      <PageHeader
        title="New Session"
        breadcrumbs={[
          { label: "Sessions", href: "/sessions" },
          { label: "New Session" },
        ]}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-3 max-w-form-narrow">
        <div className={`flex items-center gap-2 text-sm font-medium ${step === "create" ? "text-primary" : "text-accent-600"}`}>
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${step === "create" ? "bg-brand-gradient" : "bg-accent"}`}>
            {step === "create" ? "1" : "\u2713"}
          </span>
          Session Details
        </div>
        <div className="flex-1 h-0.5 bg-surface-container-high rounded-full">
          <div className={`h-full rounded-full bg-accent transition-all duration-300 ${step === "upload" ? "w-full" : "w-0"}`} />
        </div>
        <div className={`flex items-center gap-2 text-sm font-medium ${step === "upload" ? "text-primary" : "text-on-surface-variant/40"}`}>
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step === "upload" ? "bg-brand-gradient text-white" : "bg-surface-container-high text-on-surface-variant/40"}`}>
            2
          </span>
          Upload Files
        </div>
      </div>

      {step === "create" && (
        <form onSubmit={handleCreateSession} className="sa-card max-w-form-narrow space-y-5">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">School</label>
            <select
              value={form.school_id}
              onChange={(e) => setForm({ ...form, school_id: e.target.value })}
              className="sa-input"
              required
            >
              <option value="">Select a school</option>
              {schoolList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Session Date</label>
            <input
              type="date"
              value={form.session_date}
              onChange={(e) => setForm({ ...form, session_date: e.target.value })}
              className="sa-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Classes Assessed</label>
            <div className="flex gap-2">
              {[9, 10, 11, 12].map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => toggleClass(cls)}
                  className={`px-5 py-2.5 rounded text-sm font-semibold transition-all duration-200 ${
                    form.classes_assessed.includes(cls)
                      ? "bg-brand-gradient text-white shadow-sm"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  Class {cls}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Counsellor Name</label>
            <input
              value={form.counsellor_name}
              onChange={(e) => setForm({ ...form, counsellor_name: e.target.value })}
              className="sa-input"
              placeholder="Your name"
            />
          </div>

          {user?.role === "admin" && (
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">LLM Provider</label>
              <select
                value={form.llm_provider}
                onChange={(e) => setForm({ ...form, llm_provider: e.target.value })}
                className="sa-input"
              >
                <option value="groq">Groq Llama 3.3 70B (Free)</option>
                <option value="anthropic">Claude Haiku</option>
                <option value="openai">GPT-4o Mini</option>
                <option value="google">Gemini Flash</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="sa-input"
              rows={2}
              placeholder="Optional notes about this session"
            />
          </div>

          {error && (
            <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" className="btn-primary w-full">
            Create Session &amp; Continue to Upload
          </button>
        </form>
      )}

      {step === "upload" && (
        <form onSubmit={handleUpload} className="sa-card max-w-form-narrow space-y-5">
          <p className="text-sm text-on-surface-variant">
            Session created (ID: {sessionId}). Now upload the CSV files.
          </p>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">ZipGrade CSV</label>
            <label className="flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-outline-variant/40 bg-surface-container-high/50 px-6 py-8 cursor-pointer hover:border-primary/40 hover:bg-primary-50/30 transition-all">
              <svg className="w-8 h-8 text-on-surface-variant/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {zipgradeFile ? (
                <span className="text-sm font-medium text-primary">{zipgradeFile.name}</span>
              ) : (
                <span className="text-sm text-on-surface-variant/60">Click to upload ZipGrade CSV</span>
              )}
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setZipgradeFile(e.target.files?.[0] || null)}
                className="hidden"
                required
              />
            </label>
            <p className="text-xs text-on-surface-variant/50 mt-1.5">Exported from ZipGrade with Q1-Q74 columns</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Student Info CSV</label>
            <label className="flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-outline-variant/40 bg-surface-container-high/50 px-6 py-8 cursor-pointer hover:border-primary/40 hover:bg-primary-50/30 transition-all">
              <svg className="w-8 h-8 text-on-surface-variant/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {studentInfoFile ? (
                <span className="text-sm font-medium text-primary">{studentInfoFile.name}</span>
              ) : (
                <span className="text-sm text-on-surface-variant/60">Click to upload Student Info CSV</span>
              )}
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setStudentInfoFile(e.target.files?.[0] || null)}
                className="hidden"
                required
              />
            </label>
            <p className="text-xs text-on-surface-variant/50 mt-1.5">
              Columns: student_id, name, class, section, parent_phone, parent_name
            </p>
          </div>

          {error && (
            <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={uploading || !zipgradeFile || !studentInfoFile}
            className="btn-primary w-full"
          >
            {uploading ? "Uploading & Scoring..." : "Upload & Score Students"}
          </button>
        </form>
      )}
    </div>
  );
}
