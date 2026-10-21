import { apiRequest } from "./api.js";
import { createItemCard, initializeShell, showMessage } from "./ui.js";

initializeShell();
const container = document.querySelector("#recent-items");
const error = document.querySelector("#recent-error");

try {
  const data = await apiRequest("/api/items?limit=3");
  container.replaceChildren();
  if (!data.items.length) {
    container.classList.remove("item-grid");
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("h3");
    title.textContent = "No reports yet";
    const detail = document.createElement("p");
    detail.textContent = "Be the first to share a lost or found item with campus.";
    empty.append(title, detail);
    container.append(empty);
  } else {
    data.items.forEach((item) => container.append(createItemCard(item)));
  }
} catch (requestError) {
  container.replaceChildren();
  showMessage(error, requestError.message);
}
