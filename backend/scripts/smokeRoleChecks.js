/* eslint-disable no-console */
const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:5000/api";

const accounts = [
  {
    name: "super_admin",
    expectedRole: "super_admin",
    credentials: [
      { email: "superadmin@platform.com", password: "SuperSecretPass123!" },
      { email: "qa.superadmin@local.test", password: "SuperSecretPass123!" },
    ],
    endpoints: ["/auth/me", "/admin/dashboard", "/admin/organizations", "/admin/users"],
  },
  {
    name: "org_admin",
    expectedRole: "org_admin",
    credentials: [
      { email: "admin@example.com", password: "AdminPass1!" },
      { email: "qa.admin@local.test", password: "AdminPass1!" },
    ],
    endpoints: ["/auth/me", "/admin/dashboard", "/admin/staff", "/admin/complaints", "/admin/notifications"],
  },
  {
    name: "staff",
    expectedRole: "staff",
    credentials: [
      { email: "it.staff@example.com", password: "password123" },
      { email: "qa.staff@local.test", password: "password123" },
    ],
    endpoints: ["/auth/me", "/staff/dashboard", "/staff/complaints"],
  },
  {
    name: "user",
    expectedRole: "user",
    credentials: [
      { email: "john@example.com", password: "password123" },
      { email: "qa.user@local.test", password: "password123" },
    ],
    endpoints: ["/auth/me", "/complaints/my-stats", "/complaints/my-complaints"],
  },
];

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_) {
      body = { raw: text };
    }

    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function tryLogin(credential) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(credential),
  });
}

function extractToken(loginBody) {
  return loginBody?.data?.accessToken || loginBody?.accessToken || null;
}

function extractRole(meBody) {
  return meBody?.data?.user?.role || meBody?.user?.role || null;
}

async function runAccountCheck(account) {
  const result = {
    account: account.name,
    login: null,
    role: null,
    checks: [],
    pass: true,
  };

  let token = null;
  let usedCredential = null;

  for (const credential of account.credentials) {
    const loginResponse = await tryLogin(credential);
    if (loginResponse.ok) {
      token = extractToken(loginResponse.body);
      usedCredential = credential;
      result.login = { ok: true, email: credential.email, status: loginResponse.status };
      break;
    }
  }

  if (!token) {
    result.pass = false;
    result.login = {
      ok: false,
      status: "FAILED",
      email: account.credentials.map((c) => c.email).join(" | "),
    };
    return result;
  }

  const authHeader = { Authorization: `Bearer ${token}` };

  for (const endpoint of account.endpoints) {
    const response = await request(endpoint, { method: "GET", headers: authHeader });

    if (endpoint === "/auth/me") {
      const role = extractRole(response.body);
      result.role = role;
      if (!response.ok || role !== account.expectedRole) {
        result.pass = false;
      }
      result.checks.push({
        endpoint,
        status: response.status,
        ok: response.ok,
        detail: `role=${role || "unknown"}, expected=${account.expectedRole}`,
      });
      continue;
    }

    const ok = response.ok;
    if (!ok) {
      result.pass = false;
    }

    result.checks.push({
      endpoint,
      status: response.status,
      ok,
      detail: ok ? "OK" : (response.body?.message || "Request failed"),
    });
  }

  result.usedCredential = usedCredential;
  return result;
}

function printResult(result) {
  console.log(`\n=== ${result.account.toUpperCase()} ===`);
  if (!result.login?.ok) {
    console.log(`LOGIN: FAIL (${result.login?.email})`);
    return;
  }

  console.log(`LOGIN: PASS (${result.login.email})`);
  for (const check of result.checks) {
    console.log(
      `${check.ok ? "PASS" : "FAIL"} ${check.endpoint} -> ${check.status} (${check.detail})`,
    );
  }
}

async function main() {
  console.log(`Running smoke checks against: ${BASE_URL}`);
  const results = [];

  for (const account of accounts) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runAccountCheck(account);
    results.push(result);
    printResult(result);
  }

  const failures = results.filter((r) => !r.pass);
  console.log("\n=== SUMMARY ===");
  console.log(`Total roles checked: ${results.length}`);
  console.log(`Passed: ${results.length - failures.length}`);
  console.log(`Failed: ${failures.length}`);

  if (failures.length > 0) {
    console.log("Failed roles:", failures.map((f) => f.account).join(", "));
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Smoke check crashed:", error.message);
  process.exit(1);
});
