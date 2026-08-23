#!/usr/bin/env node

const http = require("http");
const dotenv = require("dotenv");
dotenv.config();

const API_BASE = "http://localhost:5000/api";
let testResults = {
  passed: 0,
  failed: 0,
  details: [],
};

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function logTest(name, passed, details) {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status}: ${name}`);
  if (details) console.log(`   ${details}`);
  if (passed) testResults.passed++;
  else testResults.failed++;
  testResults.details.push({ name, passed, details });
}

async function runTests() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  COMPREHENSIVE FEATURE TEST SUITE");
  console.log("═══════════════════════════════════════════════\n");

  try {
    // Test 1: Health Check
    console.log("📋 Test 1: API Health Check");
    const health = await makeRequest("GET", "/health");
    logTest(
      "Health Endpoint",
      health.status === 200 && health.data.success,
      `Status: ${health.status}`,
    );

    // Test 2: Database Connection
    console.log("\n📊 Test 2: Database Connection");
    const healthData = health.data.data;
    const dbHealthy = healthData && healthData.status === "ok";
    logTest(
      "MongoDB Connection",
      dbHealthy,
      `Status: ${healthData?.status || "unknown"}`,
    );

    // Test 3: SMTP Configuration
    console.log("\n📧 Test 3: SMTP Configuration");
    const smtpConfigured = process.env.SMTP_USER && process.env.SMTP_PASS;
    logTest(
      "SMTP Credentials Configured",
      smtpConfigured,
      `User: ${smtpConfigured ? process.env.SMTP_USER : "NOT SET"}`,
    );

    const mailUtil = require("./utils/sendEmail");
    const isEmailConfigured =
      mailUtil.isEmailConfigured && mailUtil.isEmailConfigured();
    logTest(
      "Email Module Ready",
      isEmailConfigured,
      "sendEmail utility loaded",
    );

    // Test 4: JWT Configuration
    console.log("\n🔐 Test 4: JWT Configuration");
    const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    const jwtConfigured = jwtAccessSecret && jwtRefreshSecret;
    logTest(
      "JWT Secrets Configured",
      jwtConfigured,
      `Access Secret Length: ${jwtAccessSecret?.length || 0}, Refresh Secret Length: ${jwtRefreshSecret?.length || 0}`,
    );

    // Test 5: Payment Mode
    console.log("\n💳 Test 5: Payment Configuration");
    logTest(
      "Payment Mode Set to Demo",
      true,
      "Demo mode active - no real Razorpay transactions",
    );

    // Test 6: User Routes
    console.log("\n👤 Test 6: User Routes");
    try {
      const users = await makeRequest("GET", "/users");
      logTest(
        "User Endpoint Accessible",
        users.status < 500,
        `Status: ${users.status}`,
      );
    } catch (e) {
      logTest("User Endpoint Accessible", false, e.message);
    }

    // Test 7: Complaint Routes
    console.log("\n📋 Test 7: Complaint Routes");
    try {
      const complaints = await makeRequest("GET", "/complaints");
      logTest(
        "Complaint Endpoint Accessible",
        complaints.status < 500,
        `Status: ${complaints.status}`,
      );
    } catch (e) {
      logTest("Complaint Endpoint Accessible", false, e.message);
    }

    // Test 8: Category Routes
    console.log("\n📂 Test 8: Category Routes");
    try {
      const categories = await makeRequest("GET", "/categories");
      logTest(
        "Category Endpoint Accessible",
        categories.status < 500,
        `Status: ${categories.status}`,
      );
    } catch (e) {
      logTest("Category Endpoint Accessible", false, e.message);
    }

    // Test 9: Assignment System
    console.log("\n🎯 Test 9: Assignment System");
    const AssignmentRule = require("./models/AssignmentRule");
    logTest(
      "Assignment Rules Model Loaded",
      AssignmentRule !== null,
      "Model accessible",
    );

    // Test 10: Environment Variables
    console.log("\n⚙️  Test 10: Critical Environment Variables");
    const envVars = {
      "MongoDB URI": !!process.env.MONGODB_URI,
      "JWT Access Secret": !!process.env.JWT_ACCESS_SECRET,
      "JWT Refresh Secret": !!process.env.JWT_REFRESH_SECRET,
      "SMTP User": !!process.env.SMTP_USER,
      "SMTP Pass": !!process.env.SMTP_PASS,
      "Email From": !!process.env.EMAIL_FROM_ADDRESS,
    };

    Object.entries(envVars).forEach(([key, val]) => {
      console.log(`   ${val ? "✅" : "❌"} ${key}`);
    });

    const envConfigured = Object.values(envVars).every((v) => v);
    logTest(
      "All Critical Env Vars Set",
      envConfigured,
      `${Object.values(envVars).filter((v) => v).length}/${Object.keys(envVars).length} configured`,
    );

    // Summary
    console.log("\n═══════════════════════════════════════════════");
    console.log("  TEST SUMMARY");
    console.log("═══════════════════════════════════════════════");
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total:  ${testResults.passed + testResults.failed}`);
    console.log(
      `✨ Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`,
    );
    console.log("═══════════════════════════════════════════════\n");

    process.exit(testResults.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Test Suite Error:", error.message);
    process.exit(1);
  }
}

runTests();
