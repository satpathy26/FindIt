import { apiRequest, getCurrentUser, imageUrl } from "./api.js";
import { formatDate, initializeShell, showMessage } from "./ui.js";

initializeShell();
const message = document.querySelector("#detail-message");
const detail = document.querySelector("#item-detail");
const itemId = new URLSearchParams(window.location.search).get("id");
let item = null;
let currentUser = null;

function displayItem(itemData) {
  item = itemData;
  const image = document.querySelector("#detail-image");
  image.src = imageUrl(item.image);
  image.alt = `Photo of ${item.title}`;
  image.addEventListener("error", () => {
    image.alt = "Item photo unavailable";
    image.removeAttribute("src");
    image.parentElement.classList.add("image-unavailable");
  }, { once: true });
  const type = document.querySelector("#detail-type");
  type.textContent = item.type === "lost" ? "Lost item" : "Found item";
  type.classList.add(item.type === "lost" ? "badge-lost" : "badge-found");
  const status = document.querySelector("#detail-status");
  status.textContent = item.status === "resolved" ? "Resolved" : "Active";
  status.className = `status-badge ${item.status === "resolved" ? "status-resolved" : "status-active"}`;
  document.querySelector("#detail-date").textContent = formatDate(item.date);
  document.querySelector("#detail-category").textContent = item.category || "Item report";
  document.querySelector("#detail-title").textContent = item.title;
  document.querySelector("#detail-description").textContent = item.description;
  document.querySelector("#detail-location").textContent = item.location;
  const reporterName = item.reporter?.name || "Campus student";
  document.querySelector("#reporter-name").textContent = reporterName;
  document.querySelector("#reporter-initial").textContent = reporterName.slice(0, 1).toUpperCase();
  message.classList.add("hidden");
  detail.classList.remove("hidden");
  const owner = currentUser && String(item.reporter?._id) === String(currentUser.id);
  document.querySelector("#owner-actions").classList.toggle("hidden", !owner);
  document.querySelector("#edit-button").href = `./report-item.html?id=${encodeURIComponent(item._id)}`;
  const statusButton = document.querySelector("#resolve-button");
  statusButton.textContent = item.status === "resolved" ? "Reopen report" : "Mark as resolved";
  document.title = `${item.title} — FindIt`;
}

const contactModal = document.querySelector("#contact-modal");
const contactStatus = document.querySelector("#contact-status");
const contactInfo = document.querySelector("#contact-info");

document.querySelector("#contact-button").addEventListener("click", async () => {
  contactInfo.classList.add("hidden");
  contactStatus.textContent = "Loading contact details…";
  contactStatus.classList.remove("contact-error");
  contactStatus.setAttribute("aria-busy", "true");
  contactModal.showModal();

  try {
    const result = await apiRequest(`/api/items/${encodeURIComponent(item._id)}/contact`);
    const contact = result.contact;
    if (!contact?.name || !contact.email || !contact.phone) {
      throw new Error("Contact information is unavailable for this reporter.");
    }

    document.querySelector("#contact-modal-title").textContent = `Contact ${contact.name}`;
    const emailLink = document.querySelector("#contact-email");
    emailLink.textContent = contact.email;
    emailLink.href = `mailto:${contact.email}`;
    const phoneLink = document.querySelector("#contact-phone");
    phoneLink.textContent = contact.phone;
    phoneLink.href = `tel:${contact.phone.replace(/[^+\d]/g, "")}`;
    contactStatus.textContent = "The reporter has chosen to share these details with authenticated students.";
    contactInfo.classList.remove("hidden");
  } catch (error) {
    if (error.status === 403) {
      contactStatus.textContent = "This reporter has kept their contact information private.";
    } else if (error.status === 401) {
      contactStatus.textContent = "Sign in to FindIt to request reporter contact details.";
    } else {
      contactStatus.textContent = error.message;
    }
    contactStatus.classList.add("contact-error");
  } finally {
    contactStatus.removeAttribute("aria-busy");
  }
});

document.querySelector("#contact-close").addEventListener("click", () => contactModal.close());
contactModal.addEventListener("click", (event) => {
  if (event.target === contactModal) contactModal.close();
});

document.querySelector("#resolve-button").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  try {
    const action = item.status === "resolved" ? "reopen" : "resolve";
    await apiRequest(`/api/items/${encodeURIComponent(item._id)}/${action}`, { method: "PATCH" });
    // Refetch so the backend repopulates the safe reporter name after its update response.
    const updated = await apiRequest(`/api/items/${encodeURIComponent(item._id)}`);
    displayItem(updated.item);
  } catch (error) {
    event.currentTarget.disabled = false;
    showMessage(message, error.message);
  }
});

document.querySelector("#delete-button").addEventListener("click", async (event) => {
  if (!window.confirm("Delete this report? This will also remove its photo.")) return;
  event.currentTarget.disabled = true;
  try {
    await apiRequest(`/api/items/${encodeURIComponent(item._id)}`, { method: "DELETE" });
    window.location.href = "./dashboard.html?deleted=1";
  } catch (error) {
    event.currentTarget.disabled = false;
    showMessage(message, error.message);
  }
});

if (!itemId) {
  showMessage(message, "No item was selected. Return to the reports page and choose an item.");
} else {
  try {
    const [result, user] = await Promise.all([
      apiRequest(`/api/items/${encodeURIComponent(itemId)}`),
      sessionStorage.getItem("finditToken") ? getCurrentUser().catch(() => null) : Promise.resolve(null)
    ]);
    currentUser = user;
    displayItem(result.item);
  } catch (error) {
    showMessage(message, error.message);
  }
}
