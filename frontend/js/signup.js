import { apiRequest } from "./api.js";
import { initializeShell, showMessage, clearMessage, setBusy } from "./ui.js";

initializeShell();
const form = document.querySelector("#signup-form");
const message = document.querySelector("#form-message");
const submit = document.querySelector("#submit-button");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(message);
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form).entries());
  if (values.password.length < 8) return showMessage(message, "Choose a password with at least 8 characters.");
  if (values.password !== values.confirmPassword) return showMessage(message, "The passwords do not match.");
  delete values.confirmPassword;

  setBusy(submit, true, "Creating account…");
  try {
    await apiRequest("/api/auth/register", { method: "POST", body: values, auth: false });
    window.location.href = "./login.html?registered=1";
  } catch (error) {
    showMessage(message, error.message);
    setBusy(submit, false);
  }
});
