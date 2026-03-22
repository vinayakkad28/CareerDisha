"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sessions as sessionsApi } from "@/lib/api";

export default function SessionsPage() {
  const [sessionList, setSessionList] = useState<any[]>([]);

  useEffect(() => {
    sessionsApi.list().then(setSessionList).catch(console.error);
  }, []);

  const statusColors: Record<string, string> = {
    draft: "bg-gray-200 text-gray-700",
    scored: "bg-blue-100 text-blue-700",
    generating: "bg-yellow-100 text-yellow-700",
    generated: "bg-purple-100 text-purple-700",
    qa_review: "bg-orange-100 text-orange-700",
    pdf_ready: "bg-green-100 text-green-700",
    delivered: "bg-green-200 text-green-800",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-primary">Sessions</h1>
        <Link
          href="/sessions/new"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          + New Session
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
        {sessionList.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400">
            No sessions yet.{" "}
            <Link href="/sessions/new" className="text-primary underline">
              Create one
            </Link>
          </div>
        ) : (
          sessionList.map((s) => (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">{s.school_name}</p>
                <p className="text-sm text-gray-500">
                  {s.school_city} &middot; {s.session_date} &middot; Classes{" "}
                  {(s.classes_assessed || []).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  {s.total_students} students
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    statusColors[s.status] || "bg-gray-100"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
