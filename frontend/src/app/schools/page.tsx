"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { schools as schoolsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState, EmptyState, ConfirmDialog } from "@/components/UIStates";
import { useToast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";

const BOARD_STYLES: Record<string, string> = {
  CBSE: "bg-primary-100 text-primary",
  ICSE: "bg-purple-100 text-purple-700",
  State: "bg-amber-100 text-amber-700",
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
    <div className="space-y-6">
      <PageHeader
        title="Schools"
        subtitle={!loading && schoolList.length > 0 ? `${schoolList.length} school${schoolList.length !== 1 ? "s" : ""} registered` : undefined}
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className={showForm ? "btn-ghost" : "btn-primary"}
          >
            {showForm ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add School
              </>
            )}
          </button>
        }
      />

      {/* Slide-down Add School Form */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showForm ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <form onSubmit={handleSubmit} className="sa-card">
          <h3 className="text-base font-heading font-semibold text-on-surface mb-5">Add New School</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">School Name *</label>
              <input
                placeholder="e.g. Delhi Public School"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="sa-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">School Code *</label>
              <input
                placeholder="e.g. DPS_MEERUT"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="sa-input font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">City *</label>
              <input
                placeholder="e.g. Meerut"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="sa-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Board</label>
              <select
                value={form.board}
                onChange={(e) => setForm({ ...form, board: e.target.value })}
                className="sa-input"
              >
                <option value="CBSE">CBSE</option>
                <option value="ICSE">ICSE</option>
                <option value="State">State Board</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Contact Person</label>
              <input
                placeholder="Principal / coordinator name"
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="sa-input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Contact Phone</label>
              <input
                placeholder="+91 XXXXX XXXXX"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className="sa-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-surface-container-high">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add School
            </button>
          </div>
        </form>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {schoolList.map((s) => (
            <div
              key={s.id}
              className="sa-card hover:bg-surface transition-all group"
            >
              {/* School Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-heading font-semibold text-on-surface truncate">{s.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {s.city && (
                        <span className="text-sm text-on-surface-variant flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {s.city}
                        </span>
                      )}
                      {s.board && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${BOARD_STYLES[s.board] || "bg-surface-container-high text-on-surface-variant"}`}>
                          {s.board}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant/50 mt-0.5 font-mono">{s.code}</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              {(s.contact_person || s.contact_phone) && (
                <div className="mt-4 pt-4 border-t border-surface-container-high flex items-center gap-4 text-sm text-on-surface-variant">
                  {s.contact_person && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {s.contact_person}
                    </span>
                  )}
                  {s.contact_phone && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {s.contact_phone}
                    </span>
                  )}
                </div>
              )}

              {/* Stats + Actions */}
              <div className="mt-4 pt-4 border-t border-surface-container-high flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary-100 text-primary text-xs font-bold">
                      {s.total_sessions ?? 0}
                    </span>
                    <span className="text-on-surface-variant">sessions</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-accent-100 text-accent-600 text-xs font-bold">
                      {s.total_students ?? 0}
                    </span>
                    <span className="text-on-surface-variant">students</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/schools/${s.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-100 rounded transition-colors"
                  >
                    View
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(s);
                    }}
                    className="inline-flex items-center px-2 py-1.5 text-sm text-on-surface-variant/50 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete school"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete School"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
