"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { schools as schoolsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState, EmptyState, ConfirmDialog } from "@/components/UIStates";
import { useToast } from "@/components/Toast";

const BOARD_STYLES: Record<string, string> = {
  CBSE: "bg-blue-50 text-blue-700",
  ICSE: "bg-purple-50 text-purple-700",
  State: "bg-amber-50 text-amber-700",
};

export default function SchoolsPage() {
  const [schoolList, setSchoolList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    city: "",
    board: "CBSE",
    contact_person: "",
    contact_phone: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const { toast } = useToast();

  const loadSchools = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await schoolsApi.list();
      setSchoolList(data);
    } catch (err: any) {
      setFetchError(err.message || "Failed to load schools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await schoolsApi.create(form);
      setForm({ name: "", code: "", city: "", board: "CBSE", contact_person: "", contact_phone: "" });
      setShowForm(false);
      toast("School created!", "success");
      loadSchools();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await schoolsApi.delete(deleteTarget.id);
      toast("School deleted", "success");
      setDeleteTarget(null);
      loadSchools();
    } catch (err: any) {
      toast(err.message, "error");
      setDeleteTarget(null);
    }
  };

  return (
    <div className="max-w-admin mx-auto">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-3xl font-extrabold text-[#1A5276] font-heading">Schools</h2>
          {!loading && schoolList.length > 0 && (
            <p className="text-slate-500 mt-1 font-medium">
              {schoolList.length} school{schoolList.length !== 1 ? "s" : ""} registered
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-6 py-3 bg-brand-gradient text-white rounded-lg font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          {showForm ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Cancel</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add School</span>
            </>
          )}
        </button>
      </div>

      {/* Add School Form (Expanded State) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showForm ? "max-h-[600px] opacity-100 mb-12" : "max-h-0 opacity-0"
        }`}
      >
        <section className="bg-white rounded-xl overflow-hidden shadow-sm">
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-[#1A5276] font-heading flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Register New Institution
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-8 gap-y-6">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">School Name</label>
                <input
                  placeholder="e.g., St. Xavier&apos;s International School"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-4 bg-surface-container-high rounded-lg focus:ring-2 focus:ring-[#1A5276] outline-none border-none transition-all placeholder:text-slate-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">School Code</label>
                <input
                  placeholder="SCH-0000"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full p-4 bg-surface-container-high rounded-lg focus:ring-2 focus:ring-[#1A5276] outline-none border-none transition-all font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">City</label>
                <input
                  placeholder="e.g., Mumbai"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full p-4 bg-surface-container-high rounded-lg focus:ring-2 focus:ring-[#1A5276] outline-none border-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Education Board</label>
                <select
                  value={form.board}
                  onChange={(e) => setForm({ ...form, board: e.target.value })}
                  className="w-full p-4 bg-surface-container-high rounded-lg focus:ring-2 focus:ring-[#1A5276] outline-none border-none transition-all appearance-none cursor-pointer"
                >
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="State">State Board</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Contact Person Name</label>
                <input
                  placeholder="Name of Principal/Admin"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  className="w-full p-4 bg-surface-container-high rounded-lg focus:ring-2 focus:ring-[#1A5276] outline-none border-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Contact Phone</label>
                <input
                  placeholder="+91 00000 00000"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  className="w-full p-4 bg-surface-container-high rounded-lg focus:ring-2 focus:ring-[#1A5276] outline-none border-none transition-all"
                  type="tel"
                />
              </div>
              <div className="col-span-2 flex justify-end items-center gap-4 mt-4 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-brand-gradient text-white rounded-lg font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  Add School
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading schools..." />
      ) : fetchError ? (
        <ErrorState message={fetchError} onRetry={loadSchools} />
      ) : schoolList.length === 0 ? (
        <EmptyState
          title="No schools yet"
          description="Add your first school to get started"
          actionLabel="Add School"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {schoolList.map((s) => (
            <article
              key={s.id}
              className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="p-8">
                {/* School Header */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-[#1A5276] font-heading mb-2">{s.name}</h4>
                    {s.city && (
                      <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{s.city}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(s);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-600 transition-all rounded-full hover:bg-red-50"
                    title="Delete school"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Board Badge + Code */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {s.board && (
                    <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${BOARD_STYLES[s.board] || "bg-surface-container-high text-slate-600"}`}>
                      {s.board}
                    </span>
                  )}
                  {s.code && (
                    <span className="px-3 py-1 bg-surface-container-high text-slate-600 text-xs font-mono rounded-full">
                      {s.code}
                    </span>
                  )}
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {s.contact_person && (
                    <div className="flex items-center gap-3 p-3 bg-surface rounded-lg">
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div className="overflow-hidden">
                        <p className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">Contact</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{s.contact_person}</p>
                      </div>
                    </div>
                  )}
                  {s.contact_phone && (
                    <div className="flex items-center gap-3 p-3 bg-surface rounded-lg">
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div className="overflow-hidden">
                        <p className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">Phone</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{s.contact_phone}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Stats + View Details */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D6EAF8]/50 text-[#1A5276] rounded-full text-xs font-bold">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{s.total_sessions ?? 0} sessions</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D6EAF8]/50 text-[#1A5276] rounded-full text-xs font-bold">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{s.total_students ?? 0} students</span>
                    </div>
                  </div>
                  <Link
                    href={`/schools/${s.id}`}
                    className="text-sm font-bold text-primary hover:text-primary-700 flex items-center gap-1 group/link"
                  >
                    View Details
                    <svg className="w-4 h-4 transition-transform group-hover/link:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete School?"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action will archive all associated student records and sessions. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
