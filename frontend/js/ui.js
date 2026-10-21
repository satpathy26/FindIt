import { clearToken, getToken, imageUrl } from "./api.js";

export function initializeShell() {
  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
  document.querySelectorAll(".menu-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const nav = button.parentElement.querySelector(".main-nav");
      const isOpen = nav.classList.toggle("open");
      button.setAttribute("aria-expanded", String(isOpen));
      button.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    });
  });
  document.querySelectorAll(".nav-logout").forEach((button) => {
    button.addEventListener("click", () => {
      clearToken();
      window.location.href = "./index.html";
    });
  });
  updateNavigation();
  window.addEventListener("findit:session-expired", updateNavigation);
}

export function updateNavigation() {
  const signedIn = Boolean(getToken());
  document.querySelectorAll(".nav-signin, .nav-signup").forEach((element) => {
    element.classList.toggle("hidden", signedIn);
  });
  document.querySelectorAll(".nav-report").forEach((element) => {
    element.classList.toggle("hidden", !signedIn);
  });
  document.querySelectorAll(".nav-logout").forEach((element) => {
    element.classList.toggle("hidden", !signedIn);
  });
}

export function formatDate(value) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not provided";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function createItemCard(item) {
  const article = document.createElement("article");
  article.className = "item-card";
  const link = document.createElement("a");
  link.className = "item-card-link";
  link.href = `./item-details.html?id=${encodeURIComponent(item._id)}`;
  link.setAttribute("aria-label", `${item.type} item: ${item.title}`);

  const imageWrap = document.createElement("div");
  imageWrap.className = "card-image-wrap";
  const image = document.createElement("img");
  image.className = "card-image";
  image.src = imageUrl(item.image);
  image.alt = item.title ? `Photo of ${item.title}` : "Photo of reported item";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.removeAttribute("src");
    image.alt = "Item photo unavailable";
    imageWrap.classList.add("image-unavailable");
  }, { once: true });
  const type = document.createElement("span");
  type.className = `type-badge ${item.type === "lost" ? "badge-lost" : "badge-found"}`;
  type.textContent = item.type === "lost" ? "Lost item" : "Found item";
  imageWrap.append(image, type);

  const body = document.createElement("div");
  body.className = "card-body";
  const meta = document.createElement("div");
  meta.className = "card-meta";
  const category = document.createElement("span");
  category.className = "card-category";
  category.textContent = item.category || "Uncategorized";
  const status = document.createElement("span");
  status.className = `status-badge ${item.status === "resolved" ? "status-resolved" : "status-active"}`;
  status.textContent = item.status === "resolved" ? "Resolved" : "Active";
  meta.append(category, status);
  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = item.title || "Untitled item";
  const location = document.createElement("p");
  location.className = "card-location";
  const locationIcon = document.createElement("span");
  locationIcon.setAttribute("aria-hidden", "true");
  locationIcon.textContent = "⌖";
  const locationText = document.createElement("span");
  locationText.textContent = item.location || "Campus location not provided";
  location.append(locationIcon, locationText);
  body.append(meta, title, location);

  const footer = document.createElement("div");
  footer.className = "card-footer";
  const reporter = document.createElement("span");
  reporter.className = "card-reporter";
  const avatar = document.createElement("span");
  avatar.className = "mini-avatar";
  const reporterName = item.reporter?.name || "Student";
  avatar.textContent = reporterName.slice(0, 1).toUpperCase();
  const reporterText = document.createElement("span");
  reporterText.textContent = reporterName;
  reporter.append(avatar, reporterText);
  const date = document.createElement("time");
  date.dateTime = item.date || "";
  date.textContent = formatDate(item.date);
  footer.append(reporter, date);

  link.append(imageWrap, body, footer);
  article.append(link);
  return article;
}

export function showMessage(element, message, kind = "error") {
  element.textContent = message;
  element.classList.remove("hidden", "success", "error");
  element.classList.add(kind);
}

export function clearMessage(element) {
  element.textContent = "";
  element.classList.remove("success", "error");
}

export function setBusy(button, busy, label = "Please wait…") {
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = label;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
