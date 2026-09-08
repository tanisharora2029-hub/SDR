import path from "path";
import { EmailService } from "../services/emailService.js";
import { ResendService } from "../services/resendService.js";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`\x1b[31m❌ ASSERTION FAILED: ${msg}\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m✅ PASS: ${msg}\x1b[0m`);
  }
}

async function runResendSuite() {
  console.log("\n=======================================================");
  console.log("  NEXUS SDR — RESEND & EMAIL INTEGRATION TEST SUITE");
  console.log("=======================================================\n");

  // -------------------------------------------------------------
  // TEST 1: PROVIDER SELECTION & METADATA
  // -------------------------------------------------------------
  console.log(">>> TEST 1: Provider Selection & Metadata Reflection...");

  // Default provider should be ETHEREAL (or initial state)
  EmailService.setActiveProvider("ETHEREAL");
  assert(EmailService.getActiveProvider() === "ETHEREAL", "Default provider set to ETHEREAL");

  const etherealInfo = await EmailService.getSenderInfo();
  assert(etherealInfo.provider === "Ethereal Sandbox", "Ethereal provider label matches");
  assert(etherealInfo.mode === "SANDBOX", "Ethereal mode is SANDBOX");
  assert(etherealInfo.senderName === "Alex Rivers", "Sender persona is Alex Rivers (AI SDR)");
  assert(typeof etherealInfo.senderEmail === "string" && etherealInfo.senderEmail.length > 0, "Sender email generated");

  // Switch to RESEND
  EmailService.setActiveProvider("RESEND");
  assert(EmailService.getActiveProvider() === "RESEND", "Provider switched to RESEND");

  const resendInfo = ResendService.getSenderInfo();
  assert(resendInfo.provider === "Resend", "Resend provider label matches");
  assert(resendInfo.mode === "LIVE", "Resend mode is LIVE");
  assert(resendInfo.senderName === "Alex Rivers", "Resend persona is Alex Rivers (AI SDR)");
  assert(typeof resendInfo.isConfigured === "boolean", "isConfigured returns boolean flag");

  // Switch back to ETHEREAL
  EmailService.setActiveProvider("ETHEREAL");
  assert(EmailService.getActiveProvider() === "ETHEREAL", "Provider safely switched back to ETHEREAL");
  console.log("TEST 1 Completed Successfully.\n");

  // -------------------------------------------------------------
  // TEST 2: AUTHENTICATION FAILURE HANDLING (No Key Leakage)
  // -------------------------------------------------------------
  console.log(">>> TEST 2: Authentication Failure & API Key Protection...");

  const invalidKey = "re_invalid_dummy_key_not_real_998877";

  // Verify connection with invalid key
  const authVerifyResult = await ResendService.verifyConnection(invalidKey);
  assert(!authVerifyResult.success, "Invalid key correctly rejected by verifyConnection");
  assert([400, 401, 403, 500].includes(authVerifyResult.statusCode || 0),
    `Returned expected HTTP failure code (${authVerifyResult.statusCode})`);
  assert(!authVerifyResult.message.includes(invalidKey), "Security check: Secret key is never leaked in error messages");

  // Send email directly with invalid key
  const authSendResult = await ResendService.sendEmail({
    to: "test-prospect@example.com",
    subject: "Auth Failure Test",
    text: "This should fail authentication."
  }, invalidKey);

  assert(!authSendResult.success, "Invalid key correctly fails sendEmail");
  assert(authSendResult.provider === "RESEND", "Provider identified as RESEND");
  assert([400, 401, 403, 500].includes(authSendResult.statusCode || 0),
    `Send failure returned expected HTTP error status (${authSendResult.statusCode})`);
  assert(!authSendResult.error?.includes(invalidKey), "Security check: Secret key is never leaked in send error message");
  console.log("TEST 2 Completed Successfully.\n");

  // -------------------------------------------------------------
  // TEST 3: SAFE FALLBACK TO ETHEREAL SANDBOX
  // -------------------------------------------------------------
  console.log(">>> TEST 3: Safe Fallback to Ethereal Sandbox on Resend Failure...");

  // Set active provider to RESEND
  EmailService.setActiveProvider("RESEND");

  // If RESEND_API_KEY is unset or fails, EmailService.sendEmail must catch it
  // and safely deliver through Ethereal so outreach is NEVER lost.
  const fallbackSendResult = await EmailService.sendEmail({
    to: "rahul.prospect@test.example",
    subject: "Autonomous Outreach - High Priority",
    text: "Hi Rahul, following up on our discussion regarding CloudFlow AI.",
    senderName: "Alex Rivers",
    forceProvider: "RESEND"
  });

  assert(fallbackSendResult.success === true, "Delivery succeeded (either live or via fallback)");

  if (fallbackSendResult.provider === "ETHEREAL") {
    assert(fallbackSendResult.fallbackUsed === true, "fallbackUsed flag is correctly set to true");
    assert(typeof fallbackSendResult.previewUrl === "string" && fallbackSendResult.previewUrl.includes("ethereal.email"),
      `Valid Ethereal preview URL generated: ${fallbackSendResult.previewUrl}`);
    console.log(`[Safe Fallback Verified] Successfully redirected to Ethereal Sandbox. Preview: ${fallbackSendResult.previewUrl}`);
  } else {
    assert(fallbackSendResult.provider === "RESEND", "Delivered via Resend LIVE");
    console.log(`[Live Resend Verified] Live email delivered. Message ID: ${fallbackSendResult.messageId}`);
  }
  console.log("TEST 3 Completed Successfully.\n");

  // -------------------------------------------------------------
  // TEST 4: RESEND DISPATCH & CAN-SPAM COMPLIANCE
  // -------------------------------------------------------------
  console.log(">>> TEST 4: Resend Dispatch Protocol & CAN-SPAM Formatting...");

  // Mock fetch to test successful Resend API response parsing
  const originalFetch = globalThis.fetch;
  let interceptedPayload: any = null;

  globalThis.fetch = async (url: any, init: any) => {
    if (url.toString().includes("api.resend.com/emails")) {
      interceptedPayload = JSON.parse(init.body);
      return new Response(
        JSON.stringify({ id: "msg_resend_live_mock_773344" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return originalFetch(url, init);
  };

  try {
    const mockSendResult = await ResendService.sendEmail({
      to: "prospect-exec@fortune500.test",
      subject: "Partnership Exploration - CloudFlow AI",
      text: "Hello, we would love to connect this week.",
      senderName: "Alex Rivers"
    }, "re_mock_test_key_for_unit_tests");

    assert(mockSendResult.success === true, "Mock Resend send succeeded");
    assert(mockSendResult.messageId === "msg_resend_live_mock_773344", "Resend message ID parsed properly");
    assert(mockSendResult.provider === "RESEND", "Provider is RESEND");
    assert(mockSendResult.isSimulated === false, "isSimulated is false for Resend LIVE");

    // Check CAN-SPAM opt-out footer in payload
    assert(interceptedPayload !== null, "Intercepted outbound payload");
    assert(interceptedPayload.to[0] === "prospect-exec@fortune500.test", "Recipient matches");
    assert(interceptedPayload.text.includes("reply STOP to unsubscribe") || interceptedPayload.text.includes("reply STOP"),
      "CAN-SPAM compliant opt-out footer present in plain text");
    assert(interceptedPayload.html.includes("STOP") && interceptedPayload.html.includes("unsubscribe"),
      "CAN-SPAM compliant opt-out footer present in HTML");
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log("TEST 4 Completed Successfully.\n");

  console.log("=======================================================");
  console.log("  ALL 4 RESEND INTEGRATION TESTS PASSED (100% GREEN)   ");
  console.log("=======================================================\n");
}

runResendSuite().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
