"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { schools as schoolsApi } from "@/lib/api";

export default function SchoolsPage() {
  const [schoolList, setSchoolList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    city: "",
    board: "CBSE",
    contact_person: "",
    contact_phone: "",
  });
  const [error, setError] = useState("");

  const loadSchools = () => {
    schoolsApi.list().then(setSchoolList).catch(console.error);
  };

  useEffect(() => {
    loadSchools();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await schoolsApi.create(form);
      setForm({ name: "", code: "", city: "", board: "CBSE", contact_person: "", contact_phone: "" });
      setShowForm(false);
      loadSchools();
    } catch (err: any) {
      setError(err.message);
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
          {error && <p className="text-red-500 text-sm col-span-2">{error}</p>}
          <button type="submit" className="col-span-2 py-2 bg-primary text-white rounded-lg hover:bg-primary-700">
            Add School
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">City</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Board</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sessions</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Students</th>
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
              </tr>
            ))}
          </tbody>
        </table>
        {schoolList.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-400">No schools added yet.</div>
        )}
      </div>
    </div>
  );
}
