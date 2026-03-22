const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("cd_token") : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets boundary automatically)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

// Auth
export const auth = {
  login: (password: string) =>
    request<{ token: string; expires_at: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  me: () => request<{ role: string; authenticated: boolean }>("/auth/me"),
};

// Schools
export const schools = {
  list: () => request<any[]>("/schools"),
  get: (id: number) => request<any>(`/schools/${id}`),
  create: (data: {
    name: string;
    code: string;
    city: string;
    board?: string;
    contact_person?: string;
    contact_phone?: string;
  }) =>
    request<any>("/schools", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Record<string, any>) =>
    request<any>(`/schools/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<any>(`/schools/${id}`, { method: "DELETE" }),
};

// Sessions
export const sessions = {
  list: (params?: { school_id?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.school_id) query.set("school_id", String(params.school_id));
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    return request<any[]>(`/sessions${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => request<any>(`/sessions/${id}`),
  create: (data: {
    school_id: number;
    session_date: string;
    classes_assessed?: number[];
    counsellor_name?: string;
    llm_provider?: string;
    notes?: string;
  }) =>
    request<any>("/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  uploadCSVs: (sessionId: number, zipgradeCsv: File, studentInfoCsv: File) => {
    const form = new FormData();
    form.append("zipgrade_csv", zipgradeCsv);
    form.append("student_info_csv", studentInfoCsv);
    return request<{ students_created: number; message: string }>(
      `/sessions/${sessionId}/upload-csvs`,
      { method: "POST", body: form }
    );
  },
  score: (id: number) =>
    request<any>(`/sessions/${id}/score`, { method: "POST" }),
  generate: (id: number) =>
    request<any>(`/sessions/${id}/generate`, { method: "POST" }),
  runQA: (id: number) =>
    request<any>(`/sessions/${id}/qa`, { method: "POST" }),
  generatePDFs: (id: number) =>
    request<any>(`/sessions/${id}/pdf`, { method: "POST" }),
  downloadURL: (id: number) => `${BASE_URL}/sessions/${id}/download`,
};

// Students
export const students = {
  get: (id: number) => request<any>(`/students/${id}`),
  downloadPdfURL: (id: number) => `${BASE_URL}/students/${id}/pdf`,
  regenerate: (id: number) =>
    request<any>(`/students/${id}/regenerate`, { method: "POST" }),
  updateDelivery: (id: number, status: string) =>
    request<any>(`/students/${id}/delivery`, {
      method: "PUT",
      body: JSON.stringify({ delivery_status: status }),
    }),
};

// Reports
export const reports = {
  qaReport: (sessionId: number) =>
    request<any>(`/reports/sessions/${sessionId}/qa-report`),
  qaApprove: (sessionId: number, studentIds: number[]) =>
    request<any>(`/reports/sessions/${sessionId}/qa-approve`, {
      method: "POST",
      body: JSON.stringify({ student_ids: studentIds }),
    }),
  deliveryChecklist: (sessionId: number) =>
    request<any>(`/reports/sessions/${sessionId}/delivery-checklist`),
};

// Dashboard
export const dashboard = {
  stats: () => request<any>("/dashboard/stats"),
  recent: (limit = 10) => request<any[]>(`/dashboard/recent?limit=${limit}`),
  costSummary: () => request<any[]>("/dashboard/cost-summary"),
};
