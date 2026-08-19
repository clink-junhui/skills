const MODEL_MAX_CREDIT_PRODUCT_ID = "modelmax-credits";
const MODEL_MAX_CREDIT_PRODUCT_NAME = "ModelMax Credits";
const PAYMENT_METHOD_TYPE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function normalizeExplicitPaymentMethodType(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized || !PAYMENT_METHOD_TYPE_PATTERN.test(normalized)) return null;
  return normalized;
}

export function resolveExplicitPaymentMethodType(data = {}, currentTurnPaymentMethodType = null) {
  const candidates = [
    data.paymentMethodType,
    data.payment_method_type,
    data.payment?.paymentMethodType,
    data.payment?.payment_method_type,
    data.session?.paymentMethodType,
    data.session?.payment_method_type,
    currentTurnPaymentMethodType,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || String(candidate).trim() === "") continue;
    return normalizeExplicitPaymentMethodType(candidate);
  }
  return null;
}

function firstNonBlank(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
}

function parsePositiveAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function resolveModelMaxRechargeScope(data = {}, fallbackAmount = null, fallbackCurrency = "USD") {
  const amount = parsePositiveAmount(
    data.amount ??
    data.default_amount ??
    data.defaultAmount ??
    data.recharge_amount ??
    data.rechargeAmount ??
    data.payment?.amount ??
    data.session?.amount ??
    fallbackAmount,
  );
  const currency = firstNonBlank(
    data.currency,
    data.payment_currency,
    data.paymentCurrency,
    data.recharge_currency,
    data.rechargeCurrency,
    data.payment?.currency,
    data.session?.currency,
    fallbackCurrency,
    "USD",
  ).toUpperCase();
  return { amount, currency };
}

function withOptionalPaymentMethodType(payload, paymentMethodType) {
  const normalized = normalizeExplicitPaymentMethodType(paymentMethodType);
  return normalized ? { ...payload, paymentMethodType: normalized } : { ...payload };
}

export function buildModelMaxCreditPayPayload({
  sessionId = null,
  merchantId = null,
  amount,
  currency,
  merchantServerName,
  paymentMethodType = null,
}) {
  const description = `ModelMax ${amount} ${currency} credits recharge`;
  return withOptionalPaymentMethodType({
    ...(sessionId ? { sessionId } : { merchant_id: merchantId, amount, currency }),
    fulfillmentType: "NO_SHIPPING_REQUIRED",
    title: "ModelMax credits recharge",
    description,
    merchantName: "ModelMax",
    mandates: [{
      title: "ModelMax credits recharge",
      description,
      amountLimit: amount,
      currencyCode: currency,
      preferredMerchantName: "ModelMax",
    }],
    products: [{
      productId: MODEL_MAX_CREDIT_PRODUCT_ID,
      productName: MODEL_MAX_CREDIT_PRODUCT_NAME,
      quantity: 1,
      unitPrice: amount,
      currencyCode: currency,
      extra: { fulfillmentType: "NO_SHIPPING_REQUIRED" },
    }],
    merchant_integration: {
      server: merchantServerName,
      confirm_tool: "check_recharge_status",
      confirm_args: {},
    },
  }, paymentMethodType);
}

export function buildModelMaxDirectPayTemplate(merchantServerName, paymentMethodType = null) {
  const normalized = normalizeExplicitPaymentMethodType(paymentMethodType);
  const paymentMethodField = normalized ? `,"paymentMethodType":"${normalized}"` : "";
  return `{"merchant_id":"<MERCHANT_ID>","amount":<AMOUNT>,"currency":"<CURRENCY>"${paymentMethodField},"fulfillmentType":"NO_SHIPPING_REQUIRED","title":"ModelMax credits recharge","description":"ModelMax <AMOUNT> <CURRENCY> credits recharge","merchantName":"ModelMax","mandates":[{"title":"ModelMax credits recharge","description":"ModelMax <AMOUNT> <CURRENCY> credits recharge","amountLimit":<AMOUNT>,"currencyCode":"<CURRENCY>","preferredMerchantName":"ModelMax"}],"products":[{"productId":"${MODEL_MAX_CREDIT_PRODUCT_ID}","productName":"${MODEL_MAX_CREDIT_PRODUCT_NAME}","quantity":1,"unitPrice":<AMOUNT>,"currencyCode":"<CURRENCY>","extra":{"fulfillmentType":"NO_SHIPPING_REQUIRED"}}],"merchant_integration":{"server":"${merchantServerName}","confirm_tool":"check_recharge_status","confirm_args":{}}}`;
}

function buildGenericInstructionCreateTemplate() {
  return `clink-cli instruction create --payment-instrument-id <PAYMENT_INSTRUMENT_ID> --title "ModelMax credits recharge" --effective-until-time "<UTC_YYYY-MM-DD HH:mm:ss>" --mandates '[{"title":"ModelMax credits recharge","description":"ModelMax <AMOUNT> <CURRENCY> credits recharge","amountLimit":<AMOUNT>,"currencyCode":"<CURRENCY>","preferredMerchantName":"ModelMax","merchantCategoryCode":"5999","effectiveUntilTime":"<UTC_YYYY-MM-DD HH:mm:ss>"}]' --shipping-address '{"name":"Clink User","line1":"One Apple Park Way","city":"Cupertino","state":"CA","zip":"95014","countryCode":"US","deliveryContactDetails":{}}' --format json`;
}

function buildGenericProductsTemplate() {
  return `[{"productId":"${MODEL_MAX_CREDIT_PRODUCT_ID}","productName":"${MODEL_MAX_CREDIT_PRODUCT_NAME}","quantity":1,"unitPrice":<AMOUNT>,"currencyCode":"<CURRENCY>","extra":{"fulfillmentType":"NO_SHIPPING_REQUIRED"}}]`;
}

function buildGenericNoShippingPayAddress() {
  return `{"street_address":"One Apple Park Way","address_locality":"Cupertino","address_region":"CA","address_country":"US","postal_code":"95014","first_name":"Clink","last_name":"User","phone_number":"+14089961010"}`;
}

export function buildGenericPaymentReadinessAndAuthorizationCommands(paymentMethodType = null) {
  const normalized = normalizeExplicitPaymentMethodType(paymentMethodType);
  if (normalized === "ALIPAY") {
    return `# Explicit ALIPAY path: do not resolve a default card.
# Do not run Visa/VIC instruction or mandate commands.
# Continue directly to pay with --payment-method-type ALIPAY.`;
  }
  return `# Run as an FSM: execute only the command for the current observed state, not every line blindly.
# Refresh payment methods and inspect data.paymentMethodsVoList:
clink-cli card binding-link --no-watch --format json
# If paymentMethodsVoList is empty, surface the bindingUrl and let the command watch payment_method.added:
clink-cli card binding-link --format json
# If the selected/default method is Visa, list reusable authorization:
clink-cli instruction list --valid-only --payment-instrument-id <PAYMENT_INSTRUMENT_ID> --format json
# If no matching ACTIVE instruction+mandate covers ModelMax <AMOUNT> <CURRENCY> credits, create one:
${buildGenericInstructionCreateTemplate()}
# instruction create watches by default; if activation was not already returned or the watch timed out, continue waiting:
clink-cli events poll --type purchase_instruction.activated --format json
clink-cli instruction list --valid-only --payment-instrument-id <PAYMENT_INSTRUMENT_ID> --format json
# If the selected/default payment method is not Visa, skip instruction commands and pay without instruction/mandate flags.`;
}

export function buildGenericDirectPayCommandTemplate(paymentMethodType = null) {
  const normalized = normalizeExplicitPaymentMethodType(paymentMethodType);
  if (normalized === "ALIPAY") {
    return `# Explicit ALIPAY path without a card PI or Visa/VIC authorization:
clink-cli pay --merchant-id <MERCHANT_ID> --amount <AMOUNT> --currency <CURRENCY> --payment-method-type ALIPAY --format json`;
  }
  const paymentMethodFlag = normalized ? ` --payment-method-type ${normalized}` : "";
  return `# Non-Visa/CARD path:
clink-cli pay --merchant-id <MERCHANT_ID> --amount <AMOUNT> --currency <CURRENCY>${paymentMethodFlag} --format json
# Visa/VIC path with matched authorization:
clink-cli pay --merchant-id <MERCHANT_ID> --amount <AMOUNT> --currency <CURRENCY>${paymentMethodFlag} --payment-instrument-id <PAYMENT_INSTRUMENT_ID> --instruction-id <INSTRUCTION_ID> --mandate-id <MANDATE_ID> --shipping-address '${buildGenericNoShippingPayAddress()}' --products '${buildGenericProductsTemplate()}' --format json`;
}

export function buildGenericSessionPayCommandTemplate(sessionId, paymentMethodType = null) {
  const normalized = normalizeExplicitPaymentMethodType(paymentMethodType);
  const resolvedSessionId = sessionId || "<SESSION_ID>";
  if (normalized === "ALIPAY") {
    return `# Explicit ALIPAY path without a card PI or Visa/VIC authorization:
clink-cli pay --session-id ${resolvedSessionId} --payment-method-type ALIPAY --format json`;
  }
  const paymentMethodFlag = normalized ? ` --payment-method-type ${normalized}` : "";
  return `# Non-Visa/CARD path:
clink-cli pay --session-id ${resolvedSessionId}${paymentMethodFlag} --format json
# Visa/VIC path with matched authorization:
clink-cli pay --session-id ${resolvedSessionId}${paymentMethodFlag} --payment-instrument-id <PAYMENT_INSTRUMENT_ID> --instruction-id <INSTRUCTION_ID> --mandate-id <MANDATE_ID> --shipping-address '${buildGenericNoShippingPayAddress()}' --products '${buildGenericProductsTemplate()}' --format json`;
}

export function buildGenericPaymentSuccessHandlingTemplate() {
  return `# If clink-cli pay exits 0 with data.status=1, use the pay result as the payment_handoff.
# If pay returns a 3DS redirect or async order handoff, wait for the correlated success event:
clink-cli events poll --type agent_order.succeeded --format json`;
}

export function buildPaymentMethodGuidance(paymentMethodType = null) {
  const normalized = normalizeExplicitPaymentMethodType(paymentMethodType);
  if (!normalized) {
    return `No payment method was explicitly selected in this current request or supplied by this 402 payload.
Do NOT infer a payment method from earlier conversation. Omit paymentMethodType / --payment-method-type so the existing default payment behavior remains unchanged.`;
  }
  if (normalized === "ALIPAY") {
    return `The explicit payment method for this payment is ALIPAY.
Pass paymentMethodType="ALIPAY" to agent-payment-skills.clink_pay or --payment-method-type ALIPAY to clink-cli pay.
Do NOT attach a card paymentInstrumentId, instruction ID, or mandate ID. The merchant mandates array remains required payment scope and is not a Visa mandate ID.`;
  }
  return `The explicit payment method for this payment is ${normalized}.
Pass paymentMethodType="${normalized}" to agent-payment-skills.clink_pay or --payment-method-type ${normalized} to clink-cli pay.
Retain the existing readiness and payment-instrument/instruction behavior. Only ALIPAY uses the no-card-PI special path.`;
}
