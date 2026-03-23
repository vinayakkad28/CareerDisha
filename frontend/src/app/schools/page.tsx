"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { schools as schoolsApi } from "@/lib/api";
import { LoadingSpinner, ErrorState, EmptyState, ConfirmDialog } from "@/components/UIStates";
import { useToast } from "@/components/Toast";

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
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-primary">Schools</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ Add School"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 mb-6 grid grid-cols-2 gap-4">
          <input
            placeholder="School Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 border rounded-lg col-span-2"
            required
          />
          <input
            placeholder="Code (e.g., DPS_MEERUT)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="px-3 py-2 border rounded-lg"
            required
          />
          <input
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="px-3 py-2 border rounded-lg"
            required
          />
          <select
            value={form.board}
            onChange={(e) => setForm({ ...form, board: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="State">State Board</option>
          </select>
          <input
            placeholder="Contact Person"
            value={form.contact_person}
            onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          />
          <input
            placeholder="Contact Phone"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          />
          <button type="submit" className="col-span-2 py-2 bg-primary text-white rounded-lg hover:bg-primary-700">
            Add School
          </button>
        </form>
      )}

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
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Board</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sessions</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Students</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schoolList.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/schools/${s.id}`} className="text-primary font-medium hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs text-gray-400">{s.code}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.city}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.board}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.total_sessions}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.total_students}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setDeleteTarget(s)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
