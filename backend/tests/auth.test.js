require("dotenv").config();

const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const User = require("../models/User");
const app = require("../server");

const testPort = Number(process.env.TEST_PORT || 8101);
const baseUrl = `http://127.0.0.1:${testPort}`;
const testUser = {
  name: "FindIt Test Student",
  rollNo: `TEST-${Date.now()}`,
  email: `findit-test-${Date.now()}@example.edu`,
  phone: "+91 98765 43210",
  password: "TestPassword123!"
};

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

async function expectStatus(response, expected, description) {
  assert.equal(response.status, expected, `${description}: expected HTTP ${expected}, got ${response.status}`);
  return response.json();
}

async function run() {
  assert.ok(process.env.MONGODB_URI, "MONGODB_URI must be set for integration tests");
  assert.ok(process.env.JWT_SECRET, "JWT_SECRET must be set for integration tests");

  const dbUrl = new URL(process.env.MONGODB_URI);
  dbUrl.pathname = `${dbUrl.pathname.replace(/\/$/, "")}_test`;
  await mongoose.connect(dbUrl.toString());
  await User.init();

  const server = app.listen(testPort);
  try {
    const health = await expectStatus(await request("/api/health"), 200, "Health check");
    assert.equal(health.database, "connected");
    console.log("✓ Phase 1 health check still reports MongoDB connected");

    const created = await expectStatus(
      await request("/api/auth/register", { method: "POST", body: testUser }),
      201,
      "Registration"
    );
    assert.equal(created.user.email, testUser.email.toLowerCase());
    assert.equal("password" in created.user, false, "Registration must not return password");
    const storedUser = await User.findOne({ email: testUser.email }).select("+password");
    assert.notEqual(storedUser.password, testUser.password, "Password must be hashed");
    console.log("✓ successful registration and password hashing");

    const duplicateEmail = await expectStatus(
      await request("/api/auth/register", { method: "POST", body: { ...testUser, rollNo: `${testUser.rollNo}-2`, email: testUser.email.toUpperCase() } }),
      409,
      "Duplicate email"
    );
    assert.match(duplicateEmail.message, /email/i);
    console.log("✓ duplicate email rejected");

    const duplicateRollNo = await expectStatus(
      await request("/api/auth/register", { method: "POST", body: { ...testUser, email: `other-${testUser.email}`, rollNo: testUser.rollNo.toLowerCase() } }),
      409,
      "Duplicate roll number"
    );
    assert.match(duplicateRollNo.message, /roll number/i);
    console.log("✓ duplicate roll number rejected");

    const missingFields = await expectStatus(
      await request("/api/auth/register", { method: "POST", body: { email: testUser.email } }),
      400,
      "Missing registration fields"
    );
    assert.match(missingFields.message, /required/i);
    console.log("✓ missing fields rejected");

    const missingLogin = await expectStatus(
      await request("/api/auth/login", { method: "POST", body: { email: testUser.email } }),
      400,
      "Missing login fields"
    );
    assert.match(missingLogin.message, /required/i);

    const badPassword = await expectStatus(
      await request("/api/auth/login", { method: "POST", body: { email: testUser.email, password: "wrong password" } }),
      401,
      "Incorrect password"
    );
    assert.match(badPassword.message, /invalid/i);
    console.log("✓ incorrect password rejected");

    const login = await expectStatus(
      await request("/api/auth/login", { method: "POST", body: { email: testUser.email.toUpperCase(), password: testUser.password } }),
      200,
      "Login"
    );
    assert.equal(typeof login.token, "string");
    assert.equal(login.user.email, testUser.email.toLowerCase());
    assert.equal("password" in login.user, false, "Login must not return password");
    console.log("✓ successful login and safe response");

    const noToken = await expectStatus(await request("/api/auth/me"), 401, "Profile without token");
    assert.match(noToken.message, /authentication required/i);
    console.log("✓ /me rejects requests without token");

    const profile = await expectStatus(await request("/api/auth/me", { token: login.token }), 200, "Profile with token");
    assert.equal(profile.user.id, created.user.id);
    assert.equal(profile.user.email, testUser.email.toLowerCase());
    assert.equal("password" in profile.user, false);
    console.log("✓ /me returns the authenticated user's safe profile");
  } finally {
    server.close();
    await User.deleteMany({ email: { $regex: /^findit-test-/ } });
    await mongoose.disconnect();
  }
}

run().catch(async (error) => {
  console.error("Auth integration test failed:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
