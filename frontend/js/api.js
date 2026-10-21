// Override this in the browser console with window.FINDIT_API_BASE if needed.
export const API_BASE = (window.FINDIT_API_BASE || "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "finditToken";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  const { auth = true, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  const token = auth ? getToken() : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body = fetchOptions.body;
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers, body });
  } catch {
    throw new ApiError("Could not reach FindIt. Check that the backend is running and try again.", 0);
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    // Some HTTP failures may not include a JSON body.
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new CustomEvent("findit:session-expired"));
      const currentPage = window.location.pathname.split("/").pop();
      if (!currentPage.includes("login")) {
        window.location.href = `./login.html?expired=1&next=${encodeURIComponent(currentPage + window.location.search)}`;
      }
    }
    throw new ApiError(data.message || `Request failed (${response.status})`, response.status);
  }

  return data;
}

export async function getCurrentUser() {
  const result = await apiRequest("/api/auth/me");
  return result.user;
}

export function imageUrl(imagePath) {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${API_BASE}/${imagePath.replace(/^\/+/, "")}`;
}
