const baseUrl = process.env.APP_URL || "http://localhost:3000";
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || "maya@example.com";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || "password123";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/health`, {}, 3_000);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await wait(1000);
  }
  throw new Error(`Server did not become healthy at ${baseUrl}`);
}

async function expectOk(path, options) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, options);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${path} returned ${response.status}: ${body.slice(0, 300)}`);
  }
  return response;
}

function cookieFrom(response) {
  const setCookie = response.headers.get("set-cookie") || "";
  return setCookie.split(",").map((part) => part.split(";")[0]).join("; ");
}

await waitForServer();

const publicPaths = [
  "/api/health",
  "/api/posts?limit=2",
  "/api/discover",
  "/api/explore",
  "/api/marketplace",
  "/api/challenges",
  "/api/stories",
  "/",
  "/explore",
  "/marketplace",
  "/challenges",
  "/u/mayamakes",
  "/groups/grp_design",
  "/events/evt_walk"
];

for (const path of publicPaths) {
  await expectOk(path);
  console.log(`✓ ${path}`);
}

const loginResponse = await expectOk("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: adminEmail, password: adminPassword })
});
const cookie = cookieFrom(loginResponse);
if (!cookie) throw new Error("Login did not return a session cookie");
console.log("✓ admin login");

const authedPaths = [
  "/api/auth/me",
  "/api/settings",
  "/api/referrals",
  "/api/saved",
  "/api/analytics",
  "/api/friends",
  "/api/messages/unread",
  "/api/admin/reports",
  "/api/admin/audit-log",
  "/api/admin/system-health",
  "/admin",
  "/settings",
  "/saved",
  "/analytics",
  "/invite"
];

for (const path of authedPaths) {
  await expectOk(path, { headers: { Cookie: cookie } });
  console.log(`✓ ${path}`);
}

const dryRun = await expectOk("/api/admin/maintenance?dryRun=true", {
  method: "POST",
  headers: { Cookie: cookie }
});
const dryRunJson = await dryRun.json();
if (!dryRunJson.ok) throw new Error("Maintenance dry run did not return ok=true");
console.log("✓ maintenance dry run");

console.log("Smoke tests passed");
