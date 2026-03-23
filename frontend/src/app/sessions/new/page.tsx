"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { schools as schoolsApi, sessions as sessionsApi } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function NewSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [schoolList, setSchoolList] = useState<any[]>([]);
  const [step, setStep] = useState<"create" | "upload">("create");
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [form, setForm] = useState({
    school_id: searchParams.get("school_id") || "",
    session_date: new Date().toISOString().split("T")[0],
    classes_assessed: [] as number[],
    counsellor_name: "",
    llm_provider: "anthropic",
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
    <div>
      <div className="mb-6">
        <Link href="/sessions" className="text-sm text-gray-500 hover:text-primary">
          &larr; Sessions
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-primary mb-6">New Session</h1>

      {step === "create" && (
        <form onSubmit={handleCreateSession} className="bg-white rounded-xl shadow-sm p-6 max-w-2xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
            <select
              value={form.school_id}
              onChange={(e) => setForm({ ...form, school_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Date</label>
            <input
              type="date"
              value={form.session_date}
              onChange={(e) => setForm({ ...form, session_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Classes Assessed</label>
            <div className="flex gap-2">
              {[8, 9, 10, 11, 12].map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => toggleClass(cls)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.classes_assessed.includes(cls)
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Class {cls}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Counsellor Name</label>
            <input
              value={form.counsellor_name}
              onChange={(e) => setForm({ ...form, counsellor_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LLM Provider</label>
            <select
              value={form.llm_provider}
              onChange={(e) => setForm({ ...form, llm_provider: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="anthropic">Claude Haiku</option>
              <option value="openai">GPT-4o Mini</option>
              <option value="google">Gemini Flash</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              placeholder="Optional notes about this session"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-700">
            Create Session & Continue to Upload
          </button>
        </form>
      )}

      {step === "upload" && (
        <form onSubmit={handleUpload} className="bg-white rounded-xl shadow-sm p-6 max-w-2xl space-y-4">
          <p className="text-sm text-gray-500 mb-4">
            Session created (ID: {sessionId}). Now upload the CSV files.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZipGrade CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setZipgradeFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Exported from ZipGrade with Q1-Q74 columns</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student Info CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setStudentInfoFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Columns: student_id, name, class, section, parent_phone, parent_name
            </p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={uploading || !zipgradeFile || !studentInfoFile}
            className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {uploading ? "Uploading & Scoring..." : "Upload & Score Students"}
          </button>
        </form>
      )}
    </div>
  );
}
