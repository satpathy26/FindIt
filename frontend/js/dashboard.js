import { apiRequest, getCurrentUser } from "./api.js";
import { createItemCard, initializeShell, showMessage } from "./ui.js";

initializeShell();
const grid = document.querySelector("#item-grid");
const message = document.querySelector("#dashboard-message");
const resultCount = document.querySelector("#result-count");
const form = document.querySelector("#filter-form");
const loadMore = document.querySelector("#load-more");
const privacySetting = document.querySelector("#contact-sharing-setting");
const shareContact = document.querySelector("#share-contact");
const privacyFeedback = document.querySelector("#privacy-feedback");
const pageSize = 9;
let currentPage = 1;
let currentParams = new URLSearchParams();
let hasNextPage = false;

try {
  if (sessionStorage.getItem("finditToken")) {
    const user = await getCurrentUser();
    document.querySelector("#welcome-message").textContent = `Welcome back, ${user.name}. See what’s happening around campus.`;
    const reportCta = document.querySelector("#report-cta");
    reportCta.href = "./report-item.html";
    privacySetting.classList.remove("hidden");
    shareContact.checked = user.shareContact === true;
  }
} catch {
  // apiRequest handles an expired token by clearing it and redirecting to sign in.
}

shareContact.addEventListener("change", async () => {
  const requestedValue = shareContact.checked;
  shareContact.disabled = true;
  privacyFeedback.textContent = "Saving your privacy choice…";
  try {
    const result = await apiRequest("/api/auth/contact-sharing", {
      method: "PATCH",
      body: { shareContact: requestedValue }
    });
    privacyFeedback.textContent = result.message;
    privacyFeedback.classList.remove("privacy-error");
  } catch (error) {
    shareContact.checked = !requestedValue;
    privacyFeedback.textContent = error.message;
    privacyFeedback.classList.add("privacy-error");
  } finally {
    shareContact.disabled = false;
  }
});

async function loadCounts() {
  try {
    const [lost, found] = await Promise.all([
      apiRequest("/api/items?status=active&type=lost&limit=1"),
      apiRequest("/api/items?status=active&type=found&limit=1")
    ]);
    document.querySelector("#lost-count").textContent = lost.pagination.totalItems;
    document.querySelector("#found-count").textContent = found.pagination.totalItems;
  } catch {
    document.querySelector("#lost-count").textContent = "—";
    document.querySelector("#found-count").textContent = "—";
  }
}

function showLoading(append) {
  if (append) return;
  grid.replaceChildren();
  for (let index = 0; index < 6; index += 1) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton-card";
    skeleton.setAttribute("aria-hidden", "true");
    grid.append(skeleton);
  }
  grid.setAttribute("aria-busy", "true");
}

async function loadReports({ append = false } = {}) {
  showLoading(append);
  message.classList.add("hidden");
  const params = new URLSearchParams(currentParams);
  params.set("page", String(currentPage));
  params.set("limit", String(pageSize));
  try {
    const result = await apiRequest(`/api/items?${params.toString()}`);
    if (!append) grid.replaceChildren();
    result.items.forEach((item) => grid.append(createItemCard(item)));
    grid.setAttribute("aria-busy", "false");
    hasNextPage = result.pagination.hasNextPage;
    loadMore.classList.toggle("hidden", !hasNextPage);
    resultCount.textContent = `${result.pagination.totalItems} report${result.pagination.totalItems === 1 ? "" : "s"}`;

    if (!result.items.length && !append) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const icon = document.createElement("span");
      icon.className = "empty-icon";
      icon.textContent = "⌕";
      const title = document.createElement("h3");
      title.textContent = "No matching reports";
      const detail = document.createElement("p");
      detail.textContent = "Try another search or clear your filters to see more campus reports.";
      empty.append(icon, title, detail);
      grid.append(empty);
    }
  } catch (error) {
    grid.replaceChildren();
    grid.setAttribute("aria-busy", "false");
    showMessage(message, error.message);
    resultCount.textContent = "";
    loadMore.classList.add("hidden");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(form);
  currentParams = new URLSearchParams();
  for (const key of ["search", "type", "category", "status"]) {
    const value = values.get(key)?.trim();
    if (value) currentParams.set(key, value);
  }
  currentPage = 1;
  loadReports();
});

document.querySelector("#clear-filters").addEventListener("click", () => {
  form.reset();
  currentParams = new URLSearchParams();
  currentPage = 1;
  loadReports();
});

loadMore.addEventListener("click", () => {
  if (!hasNextPage) return;
  currentPage += 1;
  loadReports({ append: true });
});

await Promise.all([loadCounts(), loadReports()]);
