// Normalize: strip trailing /api then re-add, so env var works with or without it
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "") + "/api";

/** Download a file with auth token, triggering a browser save dialog. */
export async function downloadFile(url: string, filename: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("cd_token") : null;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

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
    if ((res.status === 401 || res.status === 403) && typeof window !== "undefined") {
      localStorage.removeItem("cd_token");
      window.location.href = "/login";
    }
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

// Auth
export const auth = {
  login: (password: string, email?: string) =>
    request<{ token: string; expires_at: string; role: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password, ...(email ? { email } : {}) }),
    }),
  me: () => request<{ role: string; user_id: number; school_id?: number; authenticated: boolean }>("/auth/me"),
  register: (data: { email: string; name: string; password: string; role: string; school_id?: number }) =>
    request<any>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
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
    return request<{ students_created: number; message: string; warnings?: string[] }>(
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

// Consent (DPDPA)
export const consent = {
  status: (sessionId: number) => request<any>(`/consent/sessions/${sessionId}/consent-status`),
  recordConsent: (sessionId: number, studentIds: number[], method: string = "paper_form") =>
    request<any>(`/consent/sessions/${sessionId}/record-consent`, {
      method: "POST",
      body: JSON.stringify({ student_ids: studentIds, consent_method: method }),
    }),
  bulkConsent: (sessionId: number) =>
    request<any>(`/consent/sessions/${sessionId}/bulk-consent`, { method: "POST" }),
  deleteStudentData: (studentId: number) =>
    request<any>(`/consent/students/${studentId}/data`, { method: "DELETE" }),
};

// WhatsApp
export const whatsapp = {
  status: () => request<{ configured: boolean }>("/whatsapp/status"),
  send: (studentId: number) =>
    request<any>(`/whatsapp/send/${studentId}`, { method: "POST" }),
  sendBulk: (sessionId: number) =>
    request<any>(`/whatsapp/send-bulk/${sessionId}`, { method: "POST" }),
};

// School Portal
export const schoolPortal = {
  mySchool: () => request<any>("/school-portal/my-school"),
  analytics: () => request<any>("/school-portal/analytics"),
};

// Dashboard
export const dashboard = {
  stats: () => request<any>("/dashboard/stats"),
  recent: (limit = 10) => request<any[]>(`/dashboard/recent?limit=${limit}`),
  costSummary: () => request<any[]>("/dashboard/cost-summary"),
};
