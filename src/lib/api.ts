const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const ACCESS_TOKEN_KEY = "erp_access_token";
const REFRESH_TOKEN_KEY = "erp_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Shape every list endpoint now returns since the backend added DRF pagination
 * (PageNumberPagination) - previously a bare array. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown, message: string) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  const res = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = await res.json();
  localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
  return data.access as string;
}

interface ApiOptions extends RequestInit {
  auth?: boolean; // defaults to true
}

/**
 * Fetch wrapper: attaches the JWT access token, retries once with a refreshed
 * token on 401, and throws ApiError with the parsed response body on failure.
 */
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const isFormData = rest.body instanceof FormData;

  const buildHeaders = (token: string | null): HeadersInit => ({
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  });

  let token = getAccessToken();
  let res = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers: buildHeaders(token) });

  if (res.status === 401 && auth) {
    token = await refreshAccessToken();
    if (token) {
      res = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers: buildHeaders(token) });
    }
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (data && (data.error || data.detail || JSON.stringify(data))) || res.statusText;
    throw new ApiError(res.status, data, message);
  }

  return data as T;
}

/**
 * Fetches a PDF (or other binary) endpoint with the auth header attached, then opens
 * it in a new tab - a plain <a href> can't carry the Authorization header these
 * endpoints require.
 */
export async function openPdf(path: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new ApiError(res.status, null, "Failed to generate PDF.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Fetches a binary endpoint with the auth header attached and saves it to disk via a
 * synthetic <a download> click. Works the same in the browser and inside the desktop
 * app's WebView2 shell (which handles the download the same native "Save As"/Downloads-
 * folder way Edge does) - no separate Tauri dialog/fs plugin needed for this.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;
    const message = (data && (data.error || data.detail)) || res.statusText;
    throw new ApiError(res.status, data, message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export { API_BASE_URL };
