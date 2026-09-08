import assert from "node:assert";
import { app, server, parseCorsOrigins, PRODUCTION_CORS_ORIGINS } from "../server.js";

async function runCorsTests() {
  console.log("===================================================================");
  console.log("  NEXSDR — BACKEND CORS CONFIGURATION TEST SUITE");
  console.log("===================================================================\n");

  // -----------------------------------------------------------------
  // 1. UNIT TESTS FOR parseCorsOrigins
  // -----------------------------------------------------------------
  console.log(">>> TEST 1: Comma-Separated Origin Parsing...");
  const rawList = "https://nexsdr.in,https://www.nexsdr.in,https://ai-sdr-frontend-n07e.onrender.com";
  const parsed = parseCorsOrigins(rawList);
  assert.strictEqual(parsed.length, 3, "Parsed origins has length 3");
  assert.deepStrictEqual(parsed, [
    "https://nexsdr.in",
    "https://www.nexsdr.in",
    "https://ai-sdr-frontend-n07e.onrender.com"
  ]);
  console.log("✅ PASS: Comma-separated list correctly parsed into array of origins");

  console.log("\n>>> TEST 2: Whitespace and Trailing Slash Normalization...");
  const messyList = " https://nexsdr.in/ ,  https://www.nexsdr.in/  , https://ai-sdr-frontend-n07e.onrender.com/ , ";
  const normalized = parseCorsOrigins(messyList);
  assert.strictEqual(normalized.length, 3, "Empty entries stripped");
  assert.deepStrictEqual(normalized, [
    "https://nexsdr.in",
    "https://www.nexsdr.in",
    "https://ai-sdr-frontend-n07e.onrender.com"
  ]);
  console.log("✅ PASS: Whitespace and trailing slashes normalized properly");

  console.log("\n>>> TEST 3: Single Origin Support...");
  const singleOrigin = parseCorsOrigins("https://nexsdr.in");
  assert.deepStrictEqual(singleOrigin, ["https://nexsdr.in"]);
  console.log("✅ PASS: Single origin correctly returned as array");

  console.log("\n>>> TEST 4: Production Fallback Defaults...");
  const prodDefault = parseCorsOrigins(undefined, true);
  assert.deepStrictEqual(prodDefault, PRODUCTION_CORS_ORIGINS);
  assert(prodDefault.includes("https://nexsdr.in"));
  assert(prodDefault.includes("https://www.nexsdr.in"));
  assert(prodDefault.includes("https://ai-sdr-frontend-n07e.onrender.com"));
  assert(!prodDefault.includes("http://localhost:3000"), "Production defaults do not include localhost");
  console.log("✅ PASS: Production defaults return exact canonical and deployed frontend origins");

  console.log("\n>>> TEST 5: Development Fallback Defaults...");
  const devDefault = parseCorsOrigins(undefined, false);
  assert(devDefault.includes("https://nexsdr.in"));
  assert(devDefault.includes("http://localhost:3000"));
  assert(devDefault.includes("http://127.0.0.1:3000"));
  console.log("✅ PASS: Development defaults include localhost alongside production origins");

  // -----------------------------------------------------------------
  // 2. INTEGRATION HTTP CORS HEADERS TEST VIA FETCH
  // -----------------------------------------------------------------
  console.log("\n>>> TEST 6: Express CORS Middleware Header Assertion...");

  const listener = app.listen(0);
  const address = listener.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 6A: Request from https://nexsdr.in
    const resApex = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      headers: { Origin: "https://nexsdr.in" }
    });
    assert.strictEqual(resApex.status, 200);
    assert.strictEqual(
      resApex.headers.get("access-control-allow-origin"),
      "https://nexsdr.in",
      "Apex domain https://nexsdr.in is allowed"
    );
    assert.strictEqual(
      resApex.headers.get("access-control-allow-credentials"),
      "true",
      "Credentials allowed for apex domain"
    );
    console.log("✅ PASS: Origin 'https://nexsdr.in' allowed with credentials");

    // 6B: Request from https://www.nexsdr.in
    const resWww = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      headers: { Origin: "https://www.nexsdr.in" }
    });
    assert.strictEqual(resWww.status, 200);
    assert.strictEqual(
      resWww.headers.get("access-control-allow-origin"),
      "https://www.nexsdr.in",
      "Subdomain https://www.nexsdr.in is allowed"
    );
    console.log("✅ PASS: Origin 'https://www.nexsdr.in' allowed");

    // 6C: Request from https://ai-sdr-frontend-n07e.onrender.com
    const resRender = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      headers: { Origin: "https://ai-sdr-frontend-n07e.onrender.com" }
    });
    assert.strictEqual(resRender.status, 200);
    assert.strictEqual(
      resRender.headers.get("access-control-allow-origin"),
      "https://ai-sdr-frontend-n07e.onrender.com",
      "Render deployment origin is allowed"
    );
    console.log("✅ PASS: Origin 'https://ai-sdr-frontend-n07e.onrender.com' allowed");

    // 6D: Request from unauthorized origin
    const resBad = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      headers: { Origin: "https://unauthorized-domain.com" }
    });
    assert.strictEqual(resBad.status, 200);
    assert.strictEqual(
      resBad.headers.get("access-control-allow-origin"),
      null,
      "Unauthorized origin must NOT receive Access-Control-Allow-Origin"
    );
    console.log("✅ PASS: Unauthorized origin blocked from receiving CORS headers");

    // 6E: Preflight OPTIONS request
    const resOptions = await fetch(`${baseUrl}/api/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://nexsdr.in",
        "Access-Control-Request-Method": "GET"
      }
    });
    assert.strictEqual(resOptions.status, 204);
    assert.strictEqual(
      resOptions.headers.get("access-control-allow-origin"),
      "https://nexsdr.in"
    );
    console.log("✅ PASS: OPTIONS preflight handshake succeeds with status 204");
  } finally {
    listener.close();
    server.close();
  }

  console.log("\n===================================================================");
  console.log("  ALL CORS CONFIGURATION TESTS PASSED (100% GREEN)                 ");
  console.log("===================================================================\n");
}

runCorsTests().catch((err) => {
  console.error("❌ CORS TEST FAILURE:", err);
  process.exit(1);
});
