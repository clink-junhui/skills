import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';

const skillSource = await fs.readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../scripts/index.mjs', import.meta.url), 'utf8');

test('ModelMax auto-pay clink_pay payloads include old-pay fulfillment, mandate scope, and products', () => {
  assert.match(indexSource, /fulfillmentType/);
  assert.match(indexSource, /NO_SHIPPING_REQUIRED/);
  assert.match(indexSource, /mandates/);
  assert.match(indexSource, /amountLimit/);
  assert.match(indexSource, /currencyCode/);
  assert.match(indexSource, /preferredMerchantName/);
  assert.match(indexSource, /products/);
  assert.match(indexSource, /ModelMax Credits/);
  assert.match(indexSource, /unitPrice/);

  assert.doesNotMatch(indexSource, /"sessionId":"\$\{sessionId\}","merchant_integration"/);
  assert.doesNotMatch(indexSource, /"merchant_id":"<MERCHANT_ID>","amount":<AMOUNT>,"currency":"USD","merchant_integration"/);
});

test('ModelMax credit product defaults are explicit and amount-driven', () => {
  assert.match(indexSource, /const MODEL_MAX_CREDIT_PRODUCT_ID = "modelmax-credits"/);
  assert.match(indexSource, /const MODEL_MAX_CREDIT_PRODUCT_NAME = "ModelMax Credits"/);
  assert.match(indexSource, /productId: MODEL_MAX_CREDIT_PRODUCT_ID/);
  assert.match(indexSource, /productName: MODEL_MAX_CREDIT_PRODUCT_NAME/);
  assert.match(indexSource, /quantity: 1/);
  assert.match(indexSource, /unitPrice: amount/);

  assert.match(skillSource, /productId: "modelmax-credits"/);
  assert.match(skillSource, /productName: "ModelMax Credits"/);
  assert.match(skillSource, /quantity: 1/);
  assert.match(skillSource, /unitPrice: selected amount/i);
});

test('ModelMax docs stop session pay when session amount/currency scope is missing', () => {
  assert.match(skillSource, /Session Mode/);
  assert.match(skillSource, /amount.*currency.*mandate scope/is);
  assert.match(skillSource, /Do NOT call `agent-payment-skills\.clink_pay` with only `sessionId`/);
  assert.match(skillSource, /NO_SHIPPING_REQUIRED/);
  assert.match(skillSource, /products/);
  assert.match(skillSource, /pending payment intent/i);
  assert.match(skillSource, /resume_pending_payment_intent/);
});

test('ModelMax manual recharge docs require explicit amount override and merchant confirmation handoff', () => {
  assert.match(skillSource, /Manual Recharge Flow/i);
  assert.match(skillSource, /explicit.*amount.*overrides.*default_amount/is);
  assert.match(skillSource, /get_payment_config[\s\S]+merchant_id[\s\S]+default_amount[\s\S]+currency/i);
  assert.match(skillSource, /pre_check_account[\s\S]+clink_pay[\s\S]+check_recharge_status/i);
  assert.match(skillSource, /manual recharge[\s\S]+current registered ModelMax MCP server/i);
});

test('ModelMax direct 402 directive selects current-turn recharge amount before merchant default', () => {
  assert.match(indexSource, /selected amount/i);
  assert.match(indexSource, /explicit current-turn recharge amount/i);
  assert.match(indexSource, /otherwise.*default_amount/is);
  assert.doesNotMatch(indexSource, /with the merchant_id, default_amount, currency/);
  assert.doesNotMatch(indexSource, /Do NOT ask the user for an amount/);
  assert.doesNotMatch(indexSource, /Replace <MERCHANT_ID>, <AMOUNT>, and <CURRENCY> with the exact values returned by get_payment_config/);
});

test('ModelMax declares environment-specific payment skill dependencies without Hermes metadata', () => {
  assert.match(skillSource, /^related_skills:\n  - openclaw-payment-skills\n  - clink-payment-skill/m);
  assert.doesNotMatch(skillSource, /metadata:\n[\s\S]*?hermes:/);
  assert.match(skillSource, /OpenClaw runtime[\s\S]+openclaw-payment-skills[\s\S]+MCP server[\s\S]+agent-payment-skills/i);
  assert.match(skillSource, /Non-OpenClaw runtime[\s\S]+agentic-payment-skills[\s\S]+clink-payment-skill/i);
  assert.match(skillSource, /Do not treat `openclaw-payment-skills` and `agentic-payment-skills` as competing runtime servers/i);
});
