import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildGenericDirectPayCommandTemplate,
  buildGenericPaymentSuccessHandlingTemplate,
  buildGenericPaymentReadinessAndAuthorizationCommands,
  buildGenericSessionPayCommandTemplate,
  buildModelMaxCreditPayPayload,
  buildModelMaxDirectPayTemplate,
  buildPaymentMethodGuidance,
  normalizeExplicitPaymentMethodType,
  resolveExplicitPaymentMethodType,
} from "./payment-handoff.mjs";

test("normalizes only explicit safe payment method values", () => {
  assert.equal(normalizeExplicitPaymentMethodType(" alipay "), "ALIPAY");
  assert.equal(normalizeExplicitPaymentMethodType(""), null);
  assert.equal(normalizeExplicitPaymentMethodType(null), null);
  assert.equal(normalizeExplicitPaymentMethodType("ALIPAY; echo unsafe"), null);
});

test("resolves current 402 payment method before the current-turn fallback", () => {
  assert.equal(resolveExplicitPaymentMethodType({ paymentMethodType: "alipay" }, "CARD"), "ALIPAY");
  assert.equal(resolveExplicitPaymentMethodType({ session: { payment_method_type: "alipay" } }), "ALIPAY");
  assert.equal(resolveExplicitPaymentMethodType({}, "alipay"), "ALIPAY");
  assert.equal(resolveExplicitPaymentMethodType({}, null), null);
});

test("MCP direct and session payloads include ALIPAY only when explicitly selected", () => {
  const base = {
    amount: 1,
    currency: "USD",
    merchantServerName: "modelmax-media",
  };
  const defaultPayload = buildModelMaxCreditPayPayload({ ...base, merchantId: "merchant_1" });
  assert.equal("paymentMethodType" in defaultPayload, false);

  const directPayload = buildModelMaxCreditPayPayload({
    ...base,
    merchantId: "merchant_1",
    paymentMethodType: "ALIPAY",
  });
  assert.equal(directPayload.paymentMethodType, "ALIPAY");
  assert.equal("paymentInstrumentId" in directPayload, false);
  assert.equal("instructionId" in directPayload, false);
  assert.equal("mandateId" in directPayload, false);

  const sessionPayload = buildModelMaxCreditPayPayload({
    ...base,
    sessionId: "session_1",
    paymentMethodType: "ALIPAY",
  });
  assert.equal(sessionPayload.paymentMethodType, "ALIPAY");
  assert.equal(sessionPayload.sessionId, "session_1");
  assert.equal(Array.isArray(sessionPayload.mandates), true);
});

test("MCP direct template omits the optional field by default and carries ALIPAY explicitly", () => {
  const defaultTemplate = buildModelMaxDirectPayTemplate("modelmax-media");
  assert.doesNotMatch(defaultTemplate, /paymentMethodType/);

  const alipayTemplate = buildModelMaxDirectPayTemplate("modelmax-media", "ALIPAY");
  assert.match(alipayTemplate, /"paymentMethodType":"ALIPAY"/);
});

test("CLI direct and session ALIPAY commands never carry card or Visa authorization flags", () => {
  for (const command of [
    buildGenericDirectPayCommandTemplate("ALIPAY"),
    buildGenericSessionPayCommandTemplate("session_1", "ALIPAY"),
  ]) {
    assert.match(command, /--payment-method-type ALIPAY/);
    assert.match(command, /--terminal-qr/);
    assert.doesNotMatch(command, /--payment-instrument-id/);
    assert.doesNotMatch(command, /--instruction-id/);
    assert.doesNotMatch(command, /--mandate-id/);
  }

  const readiness = buildGenericPaymentReadinessAndAuthorizationCommands("ALIPAY");
  assert.match(readiness, /--payment-method-type ALIPAY --terminal-qr/);
  assert.doesNotMatch(readiness, /clink-cli card binding-link/);
  assert.doesNotMatch(readiness, /clink-cli instruction/);
});

test("other explicit payment methods keep the legacy readiness and command structure", () => {
  const readiness = buildGenericPaymentReadinessAndAuthorizationCommands("BALANCE");
  assert.match(readiness, /clink-cli card binding-link/);
  assert.match(readiness, /clink-cli instruction list/);

  for (const command of [
    buildGenericDirectPayCommandTemplate("BALANCE"),
    buildGenericSessionPayCommandTemplate("session_1", "BALANCE"),
  ]) {
    assert.match(command, /--payment-method-type BALANCE/);
    assert.match(command, /--payment-instrument-id <PAYMENT_INSTRUMENT_ID>/);
    assert.match(command, /--instruction-id <INSTRUCTION_ID>/);
    assert.match(command, /--mandate-id <MANDATE_ID>/);
  }
});

test("missing payment method preserves the legacy CLI templates", () => {
  const direct = buildGenericDirectPayCommandTemplate();
  const session = buildGenericSessionPayCommandTemplate("session_1");
  assert.doesNotMatch(direct, /--payment-method-type/);
  assert.doesNotMatch(session, /--payment-method-type/);
  assert.match(direct, /--payment-instrument-id <PAYMENT_INSTRUMENT_ID>/);
  assert.match(session, /--payment-instrument-id <PAYMENT_INSTRUMENT_ID>/);
});

test("guidance forbids history inference and explains the ALIPAY PI boundary", () => {
  assert.match(buildPaymentMethodGuidance(), /Do NOT infer a payment method from earlier conversation/);
  const alipayGuidance = buildPaymentMethodGuidance("ALIPAY");
  assert.match(alipayGuidance, /paymentMethodType="ALIPAY"/);
  assert.match(alipayGuidance, /--payment-method-type ALIPAY --terminal-qr/);
  assert.match(alipayGuidance, /Do NOT attach a card paymentInstrumentId/);
});

test("generic success guidance handles the terminal QR without retrying payment", () => {
  const guidance = buildGenericPaymentSuccessHandlingTemplate();
  assert.match(guidance, /status=5 with QR_CODE_REQUIRED/);
  assert.match(guidance, /--terminal-qr/);
  assert.match(guidance, /customerAction\.imagePath/);
  assert.match(guidance, /tool transcripts may be collapsed and are not user-visible/);
  assert.match(guidance, /repeat them exactly in a fenced text block/);
  assert.match(guidance, /Do not replace successful character output with PNG/);
  assert.match(guidance, /Do not call nodeRepl\.emitImage, view_image/);
  assert.match(guidance, /exact safe terminal warning or missing block output/);
  assert.match(guidance, /Do not retry pay or call check_recharge_status/);
  assert.match(guidance, /agent_order\.succeeded,agent_order\.failed/);
});

test("skill and 402 source expose the optional current-turn payment method contract", async () => {
  const [skillSource, indexSource, packageSource] = await Promise.all([
    fs.readFile(new URL("../SKILL.md", import.meta.url), "utf8"),
    fs.readFile(new URL("./index.mjs", import.meta.url), "utf8"),
    fs.readFile(new URL("./package.json", import.meta.url), "utf8"),
  ]);
  assert.match(skillSource, /Payment Method Selection Rule \(Hard Rule\)/);
  assert.match(skillSource, /paymentMethodType: "ALIPAY"/);
  assert.match(skillSource, /--payment-method-type ALIPAY/);
  assert.match(skillSource, /--terminal-qr/);
  assert.match(skillSource, /command transcripts may be collapsed and are not user-visible/);
  assert.match(skillSource, /fenced `text` block/);
  assert.match(skillSource, /Do not replace successful character output with PNG/);
  assert.match(skillSource, /do not call `nodeRepl\.emitImage`, `view_image`/);
  assert.match(skillSource, /version: "1\.0\.1"/);
  assert.match(indexSource, /args\?\.paymentMethodType/);
  assert.match(indexSource, /paymentMethodType: \{ type: "string"/);
  assert.match(indexSource, /version: "1\.0\.1"/);
  assert.equal(JSON.parse(packageSource).version, "1.0.1");
});
