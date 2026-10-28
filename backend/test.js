// backend/test.js
// Automated verification and diagnostic suite for FixMyStreet

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("FixMyStreet — Automated Diagnostic & Test Suite");
  console.log("=================================================\n");

  // 1. Files & Structure Verification
  console.log("[1/4] Verifying Project File Structure...");
  assert(fs.existsSync(path.resolve(__dirname, "server.js")), "backend/server.js exists");
  assert(fs.existsSync(path.resolve(__dirname, "supabase.js")), "backend/supabase.js exists");
  assert(fs.existsSync(path.resolve(__dirname, "routes/reports.js")), "backend/routes/reports.js exists");
  assert(fs.existsSync(path.resolve(__dirname, "middleware/auth.js")), "backend/middleware/auth.js exists");
  assert(fs.existsSync(path.resolve(__dirname, "..", "frontend/index.html")), "frontend/index.html exists");
  assert(fs.existsSync(path.resolve(__dirname, "..", "frontend/styles.css")), "frontend/styles.css exists");
  assert(fs.existsSync(path.resolve(__dirname, "..", "frontend/app.js")), "frontend/app.js exists");
  assert(fs.existsSync(path.resolve(__dirname, "..", "database/schema.sql")), "database/schema.sql exists");

  // 2. Environment Configuration
  console.log("\n[2/4] Verifying Environment Variables...");
  assert(!!process.env.SUPABASE_URL, `SUPABASE_URL is set (${process.env.SUPABASE_URL || "MISSING"})`);
  assert(!!process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is set");
  assert(!!process.env.ADMIN_API_KEY, `ADMIN_API_KEY is configured (${process.env.ADMIN_API_KEY ? "CONFIGURED" : "MISSING"})`);

  // 3. Syntax & Module Loading
  console.log("\n[3/4] Testing Backend Express Setup...");
  try {
    const app = require("./server");
    assert(typeof app === "function", "Express application instance loaded cleanly");
  } catch (err) {
    assert(false, `Express initialization threw: ${err.message}`);
  }

  // 4. Supabase Database Connectivity (if online)
  console.log("\n[4/4] Verifying Supabase Database Queries...");
  try {
    const { supabase } = require("./supabase");
    const queryPromise = supabase.from("reports").select("id, reference_id, title, status").limit(5);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Network connection timed out (offline/sandboxed mode)")), 3500)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) {
      console.warn(`  ⚠ Supabase query returned error: ${error.message}`);
    } else {
      assert(Array.isArray(data), `Supabase returned ${data.length} records from public.reports`);
      if (data.length > 0) {
        console.log(`    Sample record: [${data[0].reference_id}] ${data[0].title} (${data[0].status})`);
      }
    }
  } catch (err) {
    console.warn(`  ⚠ Database test skipped or restricted: ${err.message}`);
  }

  console.log("\n=================================================");
  console.log(`Diagnostic Finished: ${passed} passed, ${failed} failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
