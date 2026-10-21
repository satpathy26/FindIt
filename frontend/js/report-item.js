import { apiRequest, getCurrentUser } from "./api.js";
import { initializeShell, showMessage, clearMessage, setBusy } from "./ui.js";

initializeShell();
const token = sessionStorage.getItem("finditToken");
let currentUser = null;
if (!token) {
  window.location.href = `./login.html?next=${encodeURIComponent("report-item.html")}`;
} else {
  try {
    currentUser = await getCurrentUser();
  } catch {
    // A 401 is handled centrally by apiRequest.
  }
}

const form = document.querySelector("#report-form");
const message = document.querySelector("#form-message");
const submit = document.querySelector("#submit-button");
const fileInput = document.querySelector("#image");
const preview = document.querySelector("#image-preview");
const uploadPrompt = document.querySelector(".upload-prompt");
const editId = new URLSearchParams(window.location.search).get("id");
let previewUrl = null;

const dateInput = document.querySelector("#date");
dateInput.max = new Date().toISOString().slice(0, 10);

if (editId && currentUser) {
  try {
    const result = await apiRequest(`/api/items/${encodeURIComponent(editId)}`);
    const item = result.item;
    if (String(item.reporter?._id) !== String(currentUser.id)) {
      window.location.href = `./item-details.html?id=${encodeURIComponent(editId)}`;
    } else {
      document.querySelector(".form-panel-heading h1").textContent = "Edit your report";
      document.querySelector(".form-panel-heading p").textContent = "Update the details or add a replacement photo.";
      document.querySelector("#title").value = item.title;
      document.querySelector("#description").value = item.description;
      document.querySelector("#category").value = item.category;
      document.querySelector("#location").value = item.location;
      dateInput.value = item.date ? new Date(item.date).toISOString().slice(0, 10) : "";
      document.querySelector(`input[name="type"][value="${item.type}"]`).checked = true;
      fileInput.required = false;
      document.querySelector(".upload-prompt b").textContent = "Choose a replacement photo (optional)";
      document.querySelector(".upload-prompt small").textContent = "Leave this empty to keep the current photo.";
      submit.firstChild.textContent = "Save changes ";
      document.querySelector(".form-actions a").href = `./item-details.html?id=${encodeURIComponent(editId)}`;
      document.querySelector(".form-actions a").textContent = "Cancel";
    }
  } catch (error) {
    showMessage(message, error.message);
  }
}

fileInput.addEventListener("change", () => {
  clearMessage(message);
  const file = fileInput.files[0];
  if (!file) return;
  const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!acceptedTypes.includes(file.type)) {
    fileInput.value = "";
    preview.classList.add("hidden");
    uploadPrompt.classList.remove("hidden");
    return showMessage(message, "Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > 5 * 1024 * 1024) {
    fileInput.value = "";
    preview.classList.add("hidden");
    uploadPrompt.classList.remove("hidden");
    return showMessage(message, "Your photo must be 5 MB or smaller.");
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.classList.remove("hidden");
  uploadPrompt.classList.add("hidden");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(message);
  if (!form.reportValidity()) return;
  const file = fileInput.files[0];
  if (!file && !editId) return showMessage(message, "Add a photo before posting your report.");
  if (file && (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 5 * 1024 * 1024)) {
    return showMessage(message, "Choose a JPEG, PNG, or WebP photo up to 5 MB.");
  }

  const formValues = new FormData(form);
  const payload = new FormData();
  for (const field of ["type", "title", "description", "category", "location", "date"]) {
    payload.append(field, formValues.get(field));
  }
  if (file) payload.append("image", file);
  setBusy(submit, true, editId ? "Saving changes…" : "Posting report…");
  try {
    const endpoint = editId ? `/api/items/${encodeURIComponent(editId)}` : "/api/items";
    const method = editId ? "PATCH" : "POST";
    const result = await apiRequest(endpoint, { method, body: payload });
    showMessage(message, editId ? "Your report has been updated. Opening it…" : "Your report has been posted. Opening the item…", "success");
    window.location.href = `./item-details.html?id=${encodeURIComponent(result.item._id)}`;
  } catch (error) {
    showMessage(message, error.message);
    setBusy(submit, false);
  }
});

window.addEventListener("beforeunload", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});
