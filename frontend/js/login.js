import { apiRequest, saveToken } from "./api.js";
import { initializeShell, showMessage, clearMessage, setBusy } from "./ui.js";

initializeShell();
const form = document.querySelector("#login-form");
const message = document.querySelector("#form-message");
const submit = document.querySelector("#submit-button");

const params = new URLSearchParams(window.location.search);
if (params.has("expired")) showMessage(message, "Your session expired. Sign in again to continue.", "error");
if (params.has("registered")) showMessage(message, "Your account is ready. Sign in to continue.", "success");

document.querySelector(".password-toggle").addEventListener("click", (event) => {
  const input = document.querySelector("#password");
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  event.currentTarget.textContent = visible ? "Hide" : "Show";
  event.currentTarget.setAttribute("aria-label", visible ? "Hide password" : "Show password");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(message);
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form).entries());
  setBusy(submit, true, "Signing in…");
  try {
    const result = await apiRequest("/api/auth/login", { method: "POST", body: values, auth: false });
    saveToken(result.token);
    const next = params.get("next");
    // Only allow a local page path, so an untrusted query string cannot redirect off-site.
    const safeNext = next && /^[a-z0-9-]+\.html(?:\?.*)?$/i.test(next) ? next : "dashboard.html";
    window.location.href = `./${safeNext}`;
  } catch (error) {
    showMessage(message, error.message);
    setBusy(submit, false);
  }
});
