require("dotenv").config();

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Item = require("../models/Item");
const app = require("../server");
const { uploadDirectory } = require("../middleware/uploadMiddleware");

const testPort = Number(process.env.ITEM_TEST_PORT || 8102);
const baseUrl = `http://127.0.0.1:${testPort}`;
const stamp = Date.now();
const uploadedPaths = new Set();
const createdItems = [];
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=",
  "base64"
);

async function request(urlPath, { method = "GET", token, body, headers: suppliedHeaders = {} } = {}) {
  const headers = { ...suppliedHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  return fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined
  });
}

async function expectStatus(response, expected, label) {
  assert.equal(response.status, expected, `${label}: expected HTTP ${expected}, got ${response.status}`);
  return response.json();
}

function itemForm({ title = "Blue wallet", description = "Found near the campus library", type = "found", category = "electronics", location = "Library entrance", date = "2026-10-20", reporter } = {}, image = pngBytes, mimeType = "image/png", filename = "../../untrusted.png") {
  const form = new FormData();
  form.append("title", title);
  form.append("description", description);
  form.append("type", type);
  form.append("category", category);
  form.append("location", location);
  form.append("date", date);
  if (reporter) form.append("reporter", reporter);
  if (image !== null) form.append("image", new Blob([image], { type: mimeType }), filename);
  return form;
}

async function createItem(token, values = {}, image = pngBytes, mimeType = "image/png") {
  const data = await expectStatus(
    await request("/api/items", { method: "POST", token, body: itemForm(values, image, mimeType) }),
    201,
    "Create item"
  );
  createdItems.push(data.item._id);
  uploadedPaths.add(data.item.image);
  return data.item;
}

function tokenFor(user) {
  return jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "5m" });
}

async function run() {
  assert.ok(process.env.MONGODB_URI, "MONGODB_URI must be set for integration tests");
  assert.ok(process.env.JWT_SECRET, "JWT_SECRET must be set for integration tests");
  const dbUrl = new URL(process.env.MONGODB_URI);
  dbUrl.pathname = `${dbUrl.pathname.replace(/\/$/, "")}_test`;
  await mongoose.connect(dbUrl.toString());
  await Promise.all([User.init(), Item.init()]);

  const alice = await User.create({ name: "Item Test Alice", rollNo: `ITEM-A-${stamp}`, email: `item-a-${stamp}@example.edu`, phone: "+91 98765 11111", password: "TestPassword123!" });
  const bob = await User.create({ name: "Item Test Bob", rollNo: `ITEM-B-${stamp}`, email: `item-b-${stamp}@example.edu`, phone: "+91 98765 22222", password: "TestPassword123!" });
  assert.equal(alice.shareContact, false, "Contact sharing must be disabled by default");
  const aliceToken = tokenFor(alice);
  const bobToken = tokenFor(bob);
  const server = app.listen(testPort);

  try {
    const unauthenticated = await expectStatus(
      await request("/api/items", { method: "POST", body: itemForm() }),
      401,
      "Create without authentication"
    );
    assert.match(unauthenticated.message, /authentication required/i);
    console.log("✓ item creation requires authentication");

    assert.equal((await request("/api/items/my")).status, 401, "Private item list must require authentication");
    assert.equal((await request(`/api/items/${new mongoose.Types.ObjectId()}/contact`)).status, 401, "Contact details must require authentication");

    const missingImage = await expectStatus(
      await request("/api/items", { method: "POST", token: aliceToken, body: itemForm({}, null) }),
      400,
      "Missing image"
    );
    assert.match(missingImage.message, /photo is required/i);

    const badMime = await expectStatus(
      await request("/api/items", { method: "POST", token: aliceToken, body: itemForm({}, Buffer.from("plain text"), "text/plain") }),
      400,
      "Unsupported image format"
    );
    assert.match(badMime.message, /supported image/i);

    const spoofedImage = await expectStatus(
      await request("/api/items", { method: "POST", token: aliceToken, body: itemForm({}, Buffer.from("not really a png"), "image/png") }),
      400,
      "Invalid image signature"
    );
    assert.match(spoofedImage.message, /valid jpeg, png, or webp/i);

    const oversized = await expectStatus(
      await request("/api/items", {
        method: "POST",
        token: aliceToken,
        body: itemForm({}, Buffer.alloc(5 * 1024 * 1024 + 1), "image/png")
      }),
      413,
      "Oversized image"
    );
    assert.match(oversized.message, /5 mb/i);
    console.log("✓ missing, unsupported, spoofed, and oversized images are rejected");

    const first = await createItem(aliceToken, { title: "Blue wallet", type: "lost", reporter: bob._id.toString() });
    assert.equal(first.reporter.toString(), alice._id.toString(), "Reporter must come from the token, not request data");
    assert.match(first.image, /^\/uploads\/[0-9a-f-]{36}\.png$/);
    assert.equal(first.status, "active");
    assert.equal(first.reporter.email, undefined, "Public reporter must not include email");
    assert.equal(first.reporter.phone, undefined, "Public reporter must not include phone");
    console.log("✓ authenticated item creation stores a safe generated image path and private reporter data");

    const second = await createItem(aliceToken, { title: "USB drive", type: "found", category: "electronics", location: "Science block" });
    const third = await createItem(bobToken, { title: "Red water bottle", type: "lost", category: "accessories", location: "Sports ground" });

    const listed = await expectStatus(await request("/api/items"), 200, "Default active list");
    assert.equal(listed.pagination.totalItems, 3);
    assert.equal(listed.pagination.page, 1);
    assert.equal(listed.pagination.limit, 10);
    assert.equal(listed.items.length, 3);
    assert.equal(JSON.stringify(listed).includes(alice.email), false, "Item cards must not include email");
    assert.equal(JSON.stringify(listed).includes(alice.phone), false, "Item cards must not include phone");

    const filtered = await expectStatus(
      await request("/api/items?type=lost&category=electronics&search=wallet"),
      200,
      "Filtered items"
    );
    assert.equal(filtered.pagination.totalItems, 1);
    assert.equal(filtered.items[0]._id, first._id);

    const paged = await expectStatus(await request("/api/items?page=2&limit=1"), 200, "Paginated items");
    assert.equal(paged.pagination.page, 2);
    assert.equal(paged.pagination.limit, 1);
    assert.equal(paged.pagination.totalItems, 3);
    assert.equal(paged.items.length, 1);
    assert.equal(paged.pagination.hasPreviousPage, true);
    assert.equal(paged.pagination.hasNextPage, true);
    console.log("✓ shared list, filters, search, and pagination work");

    const single = await expectStatus(await request(`/api/items/${first._id}`), 200, "Single item");
    assert.equal(single.item._id, first._id);
    assert.equal(single.item.reporter.name, alice.name);
    assert.equal(JSON.stringify(single).includes(alice.email), false, "Item details must not include email before contact is requested");
    assert.equal(JSON.stringify(single).includes(alice.phone), false, "Item details must not include phone before contact is requested");
    assert.equal((await request("/api/items/not-an-object-id/contact", { token: bobToken })).status, 400);
    assert.equal((await request(`/api/items/${new mongoose.Types.ObjectId()}/contact`, { token: bobToken })).status, 404);

    const privateContact = await expectStatus(
      await request(`/api/items/${first._id}/contact`, { token: bobToken }),
      403,
      "Contact without consent"
    );
    assert.match(privateContact.message, /not enabled contact sharing/i);

    const malformedConsent = await expectStatus(
      await request("/api/auth/contact-sharing", { method: "PATCH", token: aliceToken, body: { shareContact: "true", phone: "attacker value" } }),
      400,
      "Non-boolean consent value"
    );
    assert.match(malformedConsent.message, /must be true or false/i);

    const enabledConsent = await expectStatus(
      await request("/api/auth/contact-sharing", { method: "PATCH", token: aliceToken, body: { shareContact: true, email: "ignored@example.com" } }),
      200,
      "Enable contact consent"
    );
    assert.equal(enabledConsent.user.shareContact, true);
    assert.equal(enabledConsent.user.email, undefined, "Consent endpoint returns only the preference");

    const sharedContact = await expectStatus(
      await request(`/api/items/${first._id}/contact`, { token: bobToken }),
      200,
      "Contact with consent"
    );
    assert.deepEqual(Object.keys(sharedContact.contact).sort(), ["email", "name", "phone"]);
    assert.equal(sharedContact.contact.name, alice.name);
    assert.equal(sharedContact.contact.email, alice.email);
    assert.equal(sharedContact.contact.phone, alice.phone);
    assert.equal(JSON.stringify(sharedContact).includes("password"), false);
    console.log("✓ reporter contact requires consent and returns only name, email, and phone");

    const allowedOrigin = await request("/api/items", { headers: { Origin: "http://localhost:5500" } });
    assert.equal(allowedOrigin.headers.get("access-control-allow-origin"), "http://localhost:5500");
    const rejectedOrigin = await request("/api/items", { headers: { Origin: "https://untrusted.example" } });
    assert.equal(rejectedOrigin.headers.get("access-control-allow-origin"), null);
    const imageResponse = await request(first.image);
    assert.equal(imageResponse.status, 200, "Uploaded photo must be publicly served");
    console.log("✓ item details and uploaded photo can be retrieved");

    const myItems = await expectStatus(await request("/api/items/my", { token: aliceToken }), 200, "My items");
    assert.equal(myItems.pagination.totalItems, 2);
    assert.ok(myItems.items.every((item) => item.reporter._id === alice._id.toString()));

    const invalidFilter = await expectStatus(await request("/api/items?type=other"), 400, "Invalid query filter");
    assert.match(invalidFilter.message, /type filter/i);
    const invalidPage = await expectStatus(await request("/api/items?page=0"), 400, "Invalid page");
    assert.match(invalidPage.message, /page/i);

    const edited = await expectStatus(
      await request(`/api/items/${second._id}`, { method: "PATCH", token: aliceToken, body: { title: "USB drive, black", status: "resolved", reporter: bob._id.toString() } }),
      200,
      "Owner update"
    );
    assert.equal(edited.item.title, "USB drive, black");
    assert.equal(edited.item.status, "active", "General updates must not mass-assign status");
    assert.equal(edited.item.reporter, alice._id.toString(), "General updates must not change reporter");

    const oldImageUrl = first.image;
    const replaced = await expectStatus(
      await request(`/api/items/${first._id}`, { method: "PATCH", token: aliceToken, body: itemForm({ title: "Blue wallet" }) }),
      200,
      "Owner image replacement"
    );
    uploadedPaths.add(replaced.item.image);
    assert.notEqual(replaced.item.image, oldImageUrl);
    assert.equal((await request(oldImageUrl)).status, 404, "Replaced image must be removed");

    for (const [method, suffix] of [["PATCH", ""], ["PATCH", "/resolve"], ["PATCH", "/reopen"], ["DELETE", ""]]) {
      const pathToRequest = `/api/items/${second._id}${suffix}`;
      const denied = await expectStatus(
        await request(pathToRequest, { method, token: bobToken, ...(method === "PATCH" && !suffix ? { body: { title: "Not allowed" } } : {}) }),
        403,
        `Other student ${method} ${suffix || "update"}`
      );
      assert.match(denied.message, /own item reports/i);
    }
    console.log("✓ owners can update and replace photos; other students cannot modify reports");

    const resolved = await expectStatus(
      await request(`/api/items/${second._id}/resolve`, { method: "PATCH", token: aliceToken }),
      200,
      "Resolve owner item"
    );
    assert.equal(resolved.item.status, "resolved");
    const closedContact = await expectStatus(
      await request(`/api/items/${second._id}/contact`, { token: bobToken }),
      409,
      "Contact on a resolved report"
    );
    assert.match(closedContact.message, /resolved/i);
    const resolvedList = await expectStatus(await request("/api/items?status=resolved"), 200, "Resolved list");
    assert.ok(resolvedList.items.some((item) => item._id === second._id));
    assert.equal((await expectStatus(await request("/api/items"), 200, "Active list after resolve")).pagination.totalItems, 2);

    const reopened = await expectStatus(
      await request(`/api/items/${second._id}/reopen`, { method: "PATCH", token: aliceToken }),
      200,
      "Owner reopen"
    );
    assert.equal(reopened.item.status, "active");
    assert.ok((await expectStatus(await request("/api/items"), 200, "Active list after reopen")).items.some((item) => item._id === second._id));

    const disabledConsent = await expectStatus(
      await request("/api/auth/contact-sharing", { method: "PATCH", token: aliceToken, body: { shareContact: false } }),
      200,
      "Disable contact consent"
    );
    assert.equal(disabledConsent.user.shareContact, false);
    assert.equal((await request(`/api/items/${first._id}/contact`, { token: bobToken })).status, 403);

    const deleted = await expectStatus(
      await request(`/api/items/${third._id}`, { method: "DELETE", token: bobToken }),
      200,
      "Owner delete"
    );
    assert.match(deleted.message, /deleted/i);
    assert.equal((await request(`/api/items/${third._id}`)).status, 404);
    assert.equal((await request(third.image)).status, 404, "Deleted report photo must be removed");
    console.log("✓ resolve, status filtering, and owner-only delete work");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (createdItems.length) await Item.deleteMany({ _id: { $in: createdItems } });
    await User.deleteMany({ _id: { $in: [alice._id, bob._id] } });
    for (const imagePath of uploadedPaths) {
      const filename = path.basename(imagePath);
      if (/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) {
        await fs.rm(path.join(uploadDirectory, filename), { force: true });
      }
    }
    await mongoose.disconnect();
  }
}

run().catch(async (error) => {
  console.error("Item integration test failed:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
