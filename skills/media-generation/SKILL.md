---
name: modelmax-media
description: "Generate images and videos via ModelMax APIs. CRITICAL RULES: (1) INSTALL NOTIFICATION MANDATE: The moment this skill finishes installing, you MUST send exactly one install success notification through `send-message.mjs` using the unified `message_key + vars` payload. (2) ACTIVATION ROUTING: If the user sends a ModelMax API key, including a bare message that starts with `sk-`, this skill MUST treat it as activation input, store it via the local ModelMax config helper, fetch balance, and continue activation in the same turn. (3) MANDATORY TOOL USE: ALWAYS call generate_image and generate_video via mcporter with the explicit config path under `~/.modelmax/mcporter.json` (do NOT omit `--args`). NEVER use curl or direct API calls."
version: "1.0.1"
related_skills:
  - openclaw-payment-skills
  - clink-payment-skill
metadata:
  openclaw:
    scriptsDir: "scripts"
    tools:
      notification_sender: "scripts/send-message.mjs"
      mcp_server: "scripts/index.bundle.mjs"
    apiKeyStorage: "~/.modelmax/config.json"
permissions:
  - network
  - system
---

Local ModelMax config storage:

- `MODELMAX_API_KEY` and `MODELMAX_AUTO_PAY` are stored in `~/.modelmax/config.json`
- Neither value is stored in `openclaw.json`

# ModelMax MCP Server

## 🚫 ALWAYS USE mcporter — NEVER CALL API DIRECTLY

> **ALWAYS call `generate_image` and `generate_video` via `npx mcporter --config "$MCPORTER_CONFIG_PATH" call`. Do NOT omit `--args`. For long-running media generation, ALWAYS pass `--timeout 300000` so mcporter does not hit its default 60s call timeout. NEVER use `curl`, `exec`, or any shell command to call the ModelMax API directly.**

```bash
MCPORTER_CONFIG_PATH="$HOME/.modelmax/mcporter.json"

# Use the currently registered ModelMax MCP server name from mcporter.
# Do NOT hardcode a stale alias in payment handoff or tool calls.

# Generate image
npx mcporter --config "$MCPORTER_CONFIG_PATH" call --timeout 300000 <modelmax-server> generate_image --args '{"prompt":"<PROMPT>","channel":"feishu","target_id":"<CHAT_ID>","target_type":"chat_id"}'

# Generate video
npx mcporter --config "$MCPORTER_CONFIG_PATH" call --timeout 300000 <modelmax-server> generate_video --args '{"prompt":"<PROMPT>","resolution":"720p","duration_seconds":5,"channel":"feishu","target_id":"<CHAT_ID>","target_type":"chat_id"}'
```

Note: 1080p and 4k resolution videos MUST use `duration_seconds: 8`.

Note: `mcporter call` defaults to a 60s timeout. Use `--timeout 300000` for ModelMax media generation so video polling can finish.

After sending a notification or media item, you may continue with a short natural-language reply when the surrounding workflow needs it. Prefer `DIRECT_SEND` for direct-delivery success paths.

## Card Ownership Matrix (Hard Rule)

Exactly one layer owns each semantic card. Do NOT duplicate card delivery.

| Event | Owner | Required behavior |
|---|---|---|
| Install complete | pre_install.mjs | Registers MCP and sends exactly one install success notification |
| API key activation summary | modelmax tool | `activate_api_key` owns the single configuration/auto-pay prompt notification |
| Balance check with `send_card:false` | tool | Returns data only; agent must decide the next notification |
| Payment-layer `✅ Payment Successful` | payment skill | ModelMax skill MUST NOT send another payment-success notification |
| `check_recharge_status` credited/paid | modelmax tool | Tool owns `✅ Recharge Successful` and pending-task resume |
| `check_recharge_status` failed/refunded | modelmax tool | Tool owns `❌ Recharge Failed` |
| Generated image/video delivery | modelmax tool + `send-message.mjs` | Tool delivers directly through the unified sender |

## Install Authorization Rule (Hard Rule)

- User requests to install this skill counts as installation authorization.
- After installation is complete, execute the post-install notification immediately via `pre_install.mjs` or `send-message.mjs`.
- Do NOT generate a text-based `/approve` block for routine install/status notifications.

## Merchant Result Ownership (Hard Rule)

For ModelMax, `check_recharge_status` is the only owner of merchant-layer recharge result notifications.

- No other layer may send `✅ Recharge Successful` for the same `order_id`.
- No other layer may send `❌ Recharge Failed` for the same `order_id`.
- Payment-layer `✅ Payment Successful` belongs to the payment skill, not ModelMax.

## Tool Return Contract (Hard Rule)

- `DIRECT_SEND`
  - Meaning: the tool already sent the notification/media
  - Agent MUST NOT send a duplicate semantic-equivalent notification/media
- `EXEC_REQUIRED`
  - Meaning: the tool returned an explicit exec command
  - Agent MUST execute it exactly once
- `DATA_ONLY`
  - Meaning: the tool returned data only
  - Agent may send the next required notification defined by this skill

## Prohibited Behaviors (Hard Rule)

- Do NOT send `✅ Recharge Successful` before `check_recharge_status` confirms `credited=true` or `status=paid`.
- Do NOT send a second `✅ Recharge Successful` or `❌ Recharge Failed` notification for the same `order_id`.
- Do NOT send a payment-layer `✅ Payment Successful` notification from ModelMax; that belongs to the payment skill.
- Do NOT infer recovery state from chat memory when `pending-auto-pay-task.json` or tool output is available.
- Do NOT paraphrase the full notification contents after the notification is already sent.

## Amount Selection Rule (Hard Rule)

There are only two valid amount sources for ModelMax recharge:

1. User override
   - If the user explicitly provides a concrete recharge amount in the current turn, you MUST use that amount.
   - This user-specified amount overrides the merchant default.

2. Merchant default (Direct Mode Only)
   - In Direct Mode (no `sessionId` provided by the 402 error), if the user does not explicitly provide a concrete recharge amount in the current turn, you MUST call `get_payment_config` and use the returned `default_amount` exactly as-is.
   - In Session Mode (when the 402 error provides a `sessionId`), do NOT call `get_payment_config`. The amount is bound to the session, but the 402/session context must still expose amount, currency, or a complete mandate scope for Visa/VIC matching.

You MUST NOT invent a third amount from memory, prior turns, habit, or judgment.
You MUST NOT replace the merchant default with `1`, `5`, or any other arbitrary amount unless the user explicitly asked for that amount in the current turn.

## Payment Method Selection Rule (Hard Rule)

- `paymentMethodType` is optional.
- Accept a payment method only when the user explicitly selects it in the current turn, or when the current 402/session payload explicitly supplies it.
- Normalize an explicit Alipay or 支付宝 selection to `paymentMethodType: "ALIPAY"`.
- For another explicitly supplied valid type, pass the normalized type through while retaining the existing readiness and payment-instrument/instruction behavior. Only `ALIPAY` gets the no-card-PI special path.
- If no payment method is explicit in the current request/payload, omit `paymentMethodType` and `--payment-method-type`. Preserve the existing default payment behavior and do not ask solely to fill this optional field.
- Never infer a payment method from prior conversation, an earlier recharge, a cached default, or a remembered preference.
- For explicit `ALIPAY`:
  - MCP: pass `paymentMethodType: "ALIPAY"` to `agent-payment-skills.clink_pay`.
  - CLI: pass `--payment-method-type ALIPAY --terminal-qr` to `clink-cli pay`.
  - Do not pass a card `paymentInstrumentId`, `--payment-instrument-id`, Visa/VIC instruction ID, or mandate ID.
  - Keep the merchant `mandates` array used for amount/currency scope; it is not a Visa/VIC mandate ID.

## Manual Recharge Flow

When the user explicitly asks to recharge ModelMax, for example "我要给 ModelMax 充值 1usd", this is a manual recharge request, not a 402 auto-pay recovery.

1. Parse the current-turn amount, currency, and optional payment method. An explicit current-turn amount overrides `default_amount`; an explicit Alipay/支付宝 choice maps to `ALIPAY`.
2. Select the payment amount for the authorization scope:
   - if the user provided an explicit amount in the current turn, use that amount and the requested/default currency;
   - otherwise call `get_payment_config` first because authorization matching requires amount/currency, then use the exact `default_amount` and `currency` returned by `get_payment_config`.
3. Run the runtime-specific Clink payment readiness and authorization gate before direct pay:
   - Generic `clink-payment-skill`:
     - If `paymentMethodType` is explicitly `ALIPAY`, do not resolve a default card and do not run card binding or Visa/VIC instruction commands; continue to direct pay with `--payment-method-type ALIPAY --terminal-qr`.
     - Otherwise run `clink-cli card binding-link --no-watch --format json` and inspect `data.paymentMethodsVoList`.
     - If no payment method is available, run `clink-cli card binding-link --format json`, surface the binding URL, and wait for `payment_method.added` before restarting the readiness gate.
     - If the selected/default method is Visa, run `clink-cli instruction list --valid-only --payment-instrument-id <PAYMENT_INSTRUMENT_ID> --format json`; if no matching ACTIVE instruction+mandate covers the selected ModelMax amount/currency, run `clink-cli instruction create` with the Apple Park no-shipping placeholder address, wait for `purchase_instruction.activated`, then re-list and select the matching `instruction_id` + `mandate_id`.
     - If the selected/default method is not Visa, do not run instruction commands; continue to direct pay after merchant info is known.
   - OpenClaw `agent-payment-skills`: use the payment skill's readiness/authorization flow. If it returns `state=INSTRUCTION_WORKFLOW_REQUIRED`, stop and wait for the payment skill's resume flow; ModelMax must not provide `instruction_id` or `mandate_id` itself.
4. Call `get_payment_config` to fetch the fresh `merchant_id`, `default_amount`, and `currency` if it was not already called in step 2.
5. Call the runtime-specific pay path with `merchant_id`, selected `amount`, selected `currency`, `fulfillmentType: "NO_SHIPPING_REQUIRED"`, `merchantName: "ModelMax"`, ModelMax Credits `products`, matching `mandates`, and `merchant_integration.confirm_tool: "check_recharge_status"`.
   - Generic `clink-payment-skill`: run `clink-cli pay --merchant-id <MERCHANT_ID> --amount <AMOUNT> --currency <CURRENCY> --format json`; for Visa/VIC include the matched `--payment-instrument-id`, `--instruction-id`, `--mandate-id`, Apple Park no-shipping placeholder `--shipping-address`, and `--products`.
     - Explicit Alipay: run `clink-cli pay --merchant-id <MERCHANT_ID> --amount <AMOUNT> --currency <CURRENCY> --payment-method-type ALIPAY --terminal-qr --format json` with no payment-instrument, instruction, or mandate ID flags.
   - OpenClaw: call `agent-payment-skills.clink_pay` with the full payload; do not call it with only merchant/session identifiers.
     - Explicit Alipay: add `paymentMethodType: "ALIPAY"` and omit `paymentInstrumentId`, `instructionId`, and `mandateId`.
   - If payment method was not explicitly selected, omit the field/flag and keep the legacy default-payment path unchanged.
   - The ModelMax Credits product is fixed as `productId: "modelmax-credits"` and `productName: "ModelMax Credits"`.
   - Set `quantity: 1`.
   - Set `unitPrice: selected amount`, where selected amount is the explicit user recharge amount when present, otherwise `default_amount`.
6. Wait for the payment layer's structured `payment_handoff`. In generic `clink-payment-skill`, parse `clink-cli pay` by exit code and `data.status`; for `exit=0` + `status=1`, build the handoff from the pay result. For explicit Alipay `status=5` plus `customerAction.type=QR_CODE_REQUIRED`, preserve the UTF-8 QR already emitted by `--terminal-qr`; if the CLI emitted its terminal warning or the runtime cannot preserve terminal spacing, display `customerAction.imagePath` as the PNG fallback. Do not retry pay or call `check_recharge_status` yet. Wait for one correlated `agent_order.succeeded,agent_order.failed` any-of event. Other async/3DS paths also wait for the matching order result before continuing.
7. Call `check_recharge_status` exactly once with that `payment_handoff`. Do not send merchant-layer recharge success before `check_recharge_status` returns `credited=true` or `status=paid`.

For manual recharge, `merchant_integration.server` must use the current registered ModelMax MCP server name. Do not hardcode a stale alias. For 402 recovery, use the server value from the 402 directive.

## Merchant Payment Handoff Contract

### Payment Skill Dependency Boundary

- OpenClaw runtime depends on `openclaw-payment-skills`; its registered MCP server name is `agent-payment-skills`, so OpenClaw payment calls use `agent-payment-skills.<tool>`.
- Non-OpenClaw runtime depends on the `agentic-payment-skills` repository, whose skill name is `clink-payment-skill`; use that skill's invocation surface for generic agent payment execution.
- Do not treat `openclaw-payment-skills` and `agentic-payment-skills` as competing runtime servers in the same environment. Select exactly one payment dependency by runtime first, then let that payment skill own the Clink FSM.

ModelMax should drive its own merchant payment intent and hand off Clink execution to the runtime-specific payment skill. In OpenClaw, call `agent-payment-skills.clink_pay` directly.

- The `merchant_integration.server` value MUST match the current registered ModelMax MCP server. In HTTP 402 auto-pay recovery, use the server name provided in the SYSTEM DIRECTIVE. In manual recharge, use the active ModelMax server name from the current runtime. Do NOT guess or hardcode this value.

- Runtime-specific payment commands:
  - OpenClaw runtime uses MCP tools exposed by `agent-payment-skills`, including `agent-payment-skills.pre_check_account` for readiness and `agent-payment-skills.clink_pay` for pay / instruction workflow handoff.
  - Generic `agentic-payment-skills` runtime does not define `pre_check_account` or `clink_pay` tool names. Use `clink-payment-skill` by executing the real CLI commands as state transitions, not as a blind linear shell script:
    - readiness: `clink-cli card binding-link --no-watch --format json`
    - authorization lookup: `clink-cli instruction list --valid-only --payment-instrument-id <PAYMENT_INSTRUMENT_ID> --format json`
    - authorization creation when no match exists: `clink-cli instruction create ... --shipping-address '{"name":"Clink User","line1":"One Apple Park Way","city":"Cupertino","state":"CA","zip":"95014","countryCode":"US","deliveryContactDetails":{}}' --format json`, then wait for `clink-cli events poll --type purchase_instruction.activated --format json`
    - direct pay: `clink-cli pay --merchant-id <MERCHANT_ID> --amount <AMOUNT> --currency <CURRENCY> --format json`
    - session pay: `clink-cli pay --session-id <SESSION_ID> --format json`
    - explicit Alipay direct/session pay: add `--payment-method-type ALIPAY --terminal-qr` and do not add payment-instrument, instruction, or mandate ID flags
    - async payment success wait, when pay returns a redirect or pending async handoff: `clink-cli events poll --type agent_order.succeeded --format json`
    - Visa/VIC pay must additionally include the matched `--payment-instrument-id`, `--instruction-id`, `--mandate-id`, Apple Park no-shipping `--shipping-address`, and ModelMax Credits `--products`.

- For session-mode flows, pass:
  - `sessionId`
  - optional `paymentMethodType` only when explicit in the current request/session payload
  - `fulfillmentType: "NO_SHIPPING_REQUIRED"`
  - `title: "ModelMax credits recharge"`
  - `description`
  - `merchantName: "ModelMax"`
  - `mandates` with `amountLimit`, `currencyCode`, and `preferredMerchantName: "ModelMax"`
  - `products` containing `ModelMax Credits` with `unitPrice` in the same currency
  - `merchant_integration: {"server":"<VALUE_FROM_DIRECTIVE>","confirm_tool":"check_recharge_status","confirm_args":{}}`
  - Do NOT call `agent-payment-skills.clink_pay` with only `sessionId`; if the session 402 payload lacks amount/currency mandate scope, stop and require the session payment context first.
  - In generic `clink-payment-skill`, do not call nonexistent `agent-payment-skills.*` tools. Use the real `clink-cli` readiness, authorization, and `clink-cli pay --session-id <SESSION_ID>` commands above.
- For direct-mode pay, `get_payment_config` must be called before `clink-cli pay` / `agent-payment-skills.clink_pay` so `merchant_id` is fresh. If the current user request already contains amount/currency, generic `clink-payment-skill` may complete readiness and authorization before `get_payment_config`; if amount/currency are missing, call `get_payment_config` before authorization so the mandate scope is complete. Then pass:
  - `merchant_id`
  - `amount`
  - `currency`
  - optional `paymentMethodType` only when explicit in the current turn
  - `fulfillmentType: "NO_SHIPPING_REQUIRED"`
  - `title`, `description`, `merchantName`
  - `mandates` and `products` matching the exact amount/currency
  - `merchant_integration: {"server":"<VALUE_FROM_DIRECTIVE>","confirm_tool":"check_recharge_status","confirm_args":{}}`

If `agent-payment-skills.clink_pay` returns `state=INSTRUCTION_WORKFLOW_REQUIRED` with a pending payment intent / `Payment Intent ID`, ModelMax must stop the current pay attempt and keep the pending task. Do not call pay again and do not provide `instruction_id` or `mandate_id` from ModelMax. The payment skill owns `resume_pending_payment_intent` after instruction activation and will later emit the payment handoff for `check_recharge_status`.

## Sending Notifications

This skill includes a standalone notification sender:

```bash
# Send a localized notification payload
node {SKILL_DIR}/scripts/send-message.mjs --payload '{"channel":"feishu","target":{"type":"chat_id","id":"oc_xxx","locale":"zh-CN"},"message_key":"install.success","vars":{}}'

# Send the same semantic notification to another channel
node {SKILL_DIR}/scripts/send-message.mjs --payload '{"channel":"telegram","target":{"type":"target_id","id":"12345","locale":"en-US"},"message_key":"install.success","vars":{}}'
```

The sender renders Feishu cards for Feishu, rich Telegram text/media for Telegram, and Markdown/text fallback for other channels.

## Features

- `activate_api_key`: Saves the pasted ModelMax API key, verifies it immediately, and sends the activation summary notification directly when the notify target is provided.
- `generate_image`: Generates an image using ModelMax and delivers it directly through `send-message.mjs`.
- `generate_video`: Generates a video using ModelMax and delivers it directly through `send-message.mjs`.
- `get_payment_config`: Retrieves the ModelMax payment config: `merchant_id`, `default_amount`, and `currency`.
- `check_balance`: Checks your current ModelMax API balance.

## Setup & Installation

Do not duplicate installation steps in this file. When the user asks to install this skill, follow `README.md` / `README-zh.md` only:

- Use `Manual Install` for standalone repo installs.
- Use `Installation for OpenClaw` for OpenClaw-managed installs.
- Do not substitute a partial MCP-only setup for the documented install flow.

### 1. Initialization & Setup
When the user activates this skill, you MUST follow these steps in order:

1. **Send install success notification immediately after the documented install flow succeeds:**
   - For OpenClaw-managed installs, prefer `scripts/pre_install.mjs`; it registers the MCP server and sends the install success notification directly.
   - All channels should use the unified `message_key` payload: `{"message_key":"install.success","vars":{}}`.
   - Do not delay the install notification waiting for any later restart/status callback.
   - After sending the notification, you may continue with a short natural-language reply.

2. **Request API Key:** Wait for the user to provide their ModelMax API Key. Guide them to [ModelMax](https://www.modelmax.io/dashboard/keys) if they don't have one.
3. **Handle pasted API Key immediately:** If the user's next message looks like a ModelMax API key (for example starts with `sk-`), you MUST treat it as the activation payload and continue the flow in the same turn. Do NOT stop after acknowledging receipt.
   - First run `activate_api_key` and pass the current notify target so the tool can send the activation summary directly:
     ```bash
     npx mcporter --config "$MCPORTER_CONFIG_PATH" call --timeout 300000 <modelmax-server> activate_api_key --args '{"api_key":"<PASTED_KEY>","channel":"<CHANNEL>","target_id":"<TARGET_ID>","target_type":"<TARGET_TYPE>"}'
     ```
   - If the tool returns `DIRECT_SEND`, do NOT send another activation/configuration notification.
   - After the tool succeeds, you may continue with a short natural-language reply.
4. **Verify API Key:** Once the API Key is configured in the local ModelMax config file (or if it is already present in the environment), you MUST immediately call `check_balance` with `send_card: false` (do NOT omit --args):
   ```
   npx mcporter --config "$MCPORTER_CONFIG_PATH" call --timeout 300000 <modelmax-server> check_balance --args '{"send_card":false}'
   ```
   If `check_balance` returns an error, inform the user to re-check their API key.

### 2. Automatic Top-Up Configuration
If you are in the pasted-key activation path, `activate_api_key` already owns and sends the activation summary notification. Use the rules below only when you are verifying an already-configured key via `check_balance` with `send_card:false`.

#### Routing Boundary Rule (Hard Rule)

Route generic auto-top-up language by active merchant context, not by keyword alone.

- While the user is in ModelMax activation, balance configuration, or 402 recovery flow, generic phrases such as "Enable auto top-up", "开启自动充值", or equivalent wording in the user's language belong to ModelMax first.
- Do NOT hand off the user's request to `agent-payment-skills` just because the phrase mentions auto top-up.
- Call or install `agent-payment-skills` only as a dependency for wallet/payment setup, then resume the ModelMax flow immediately after that dependency work completes.
- If the user explicitly asks for Clink setup, payment wallet setup, card binding, or payment-method management as the primary intent, that infrastructure request may belong to `agent-payment-skills` instead of ModelMax.

**Any channel — send the unified semantic payload:**
```bash
node {SKILL_DIR}/scripts/send-message.mjs --payload '{"channel":"<CHANNEL>","target":{"type":"<TARGET_TYPE>","id":"<TARGET_ID>","locale":"<LOCALE>"},"message_key":"config.verified","vars":{"balance":"<BALANCE>","autoPayEnabled":false}}'
```

`check_balance` supports a `send_card` parameter. During activation, you MUST call it with `{"send_card":false}` so it only returns balance data and does not end the turn early. For normal user-facing balance checks, omit the parameter and let it send the standard balance notification.

Important:
- `send_card:false` means `DATA_ONLY`
- When `send_card:false`, `check_balance` MUST NOT send any balance notification
- In that mode, the agent owns the next configuration notification
- In normal balance-check mode, if the tool direct-sends the balance notification, the agent MUST NOT send a second balance notification

**Default behavior: do NOT enable auto-pay.** Only proceed if the user explicitly asks to enable auto top-up in the current turn. Match semantic intent in the user's language; do NOT require the exact text "Enable auto top-up".

**If the user explicitly asks to enable auto top-up** (for example, "Enable auto top-up", "开启自动充值", or equivalent wording in their language):
1. **MANDATORY CHECK**: You MUST execute the `exec` tool with the command `ls -la ~/.openclaw/workspace/skills/agent-payment-skills` to physically verify if the payment skill is installed. DO NOT rely on your conversation memory.
2. **If the directory DOES NOT exist**:
   - Treat the user's explicit auto top-up request as explicit authorization to install the missing dependency skill immediately.
   - Do NOT stop at a missing-skill warning or an install URL notification.
   - Immediately download/install `agent-payment-skills` and initiate its installation flow.
   - Note that installation involves a gateway restart. After the restart completes and the user finishes the wallet initialization and card binding (which will span across multiple conversation turns), you MUST inject this context update into the current flow before proceeding: `agent-payment-skills is now installed and initialized for this user; wallet and card setup completed; resume the pending auto-pay configuration flow now.`
   - After that context update is established, proceed to step 3 immediately. Do NOT restart the install check loop.
3. **If the directory EXISTS** (or after it has been successfully installed and initialized per step 2):
   - Call `agent-payment-skills.pre_check_account` (do NOT omit --args):
     ```
     npx mcporter --config "$MCPORTER_CONFIG_PATH" call --timeout 300000 agent-payment-skills pre_check_account --args '{}'
     ```
   - **If pre_check_account fails** (wallet not initialized or no card bound): Follow the `agent-payment-skills` initialization instructions to fix the issue (initialize wallet / bind card) before proceeding. DO NOT enable auto top-up until pre-check passes.
   - **If pre_check_account passes**: IMMEDIATELY use the `exec` tool to run: `node {SKILL_DIR}/scripts/set-auto-pay.mjs true`
   - After the exec command succeeds, **immediately** send ONE final confirmation notification:
     - All channels should use the unified payload: `{"message_key":"autopay.enabled","vars":{}}`
   - After sending this notification, you may continue with a short natural-language reply.

**During later 402 auto-pay recovery:**
- `payment handoff` means the payment layer has confirmed successful payment and provided a structured `payment_handoff` payload for merchant recharge confirmation.
- If the current user turn explicitly selects a payment method, include `paymentMethodType` in the `generate_image` / `generate_video` tool args so the generated 402 directive can carry it. Omit it otherwise.
- The current 402/session payload takes precedence when it explicitly supplies `paymentMethodType`; otherwise use only the explicit current-turn tool argument. Never recover it from chat history.
- For session-based recovery, the ModelMax merchant backend has already created the Clink payment session before returning HTTP 402. Use the returned `sessionId` plus `NO_SHIPPING_REQUIRED`, mandate scope, products, and `merchant_integration`; never pay with only `sessionId`.
- For generic `clink-payment-skill`, use the real `clink-cli` readiness/authorization/pay commands from the Merchant Payment Handoff Contract. For OpenClaw, call `agent-payment-skills.clink_pay` with the full payload.
- For direct-mode recovery, if amount/currency are already explicit, perform payment readiness/authorization first, then call `get_payment_config`, then pay with `merchant_id`, `amount`, `currency`, `NO_SHIPPING_REQUIRED`, mandate scope, products, and `merchant_integration`. If amount/currency are not explicit, call `get_payment_config` before authorization so the mandate scope is complete.
- If payment returns a pending payment intent, wait for the payment skill's `resume_pending_payment_intent` flow and final payment handoff.
- If a later payment handoff arrives, you MUST pass its `payment_handoff` object through to `check_recharge_status` exactly as received.

### 402 Recovery Contract (Hard Rule)

After payment handoff:
1. Call `check_recharge_status` exactly once.
2. If `check_recharge_status` direct-sent `✅ Recharge Successful`, do NOT send another recharge-success notification.
3. If `check_recharge_status` direct-sent `❌ Recharge Failed`, do NOT send another failure notification.
4. If `check_recharge_status` returns an explicit exec directive, execute it exactly once.
5. The `check_recharge_status` tool will automatically resume the pending image/video task upon success. Do NOT manually resume the task yourself unless the tool explicitly instructs you to.

- Current implementation persists pending auto-pay tasks under `~/.openclaw/state/modelmax-media/pending-auto-pay-task.json`, so recharge confirmation can resume the original task even when ModelMax tools are called through short-lived subprocesses.
- For automatic 402 / low-balance recovery, if the user did not explicitly provide a new amount in the current turn, you MUST use the exact `default_amount` returned by `get_payment_config`.

**If the user does not explicitly ask to enable auto top-up** (any other reply, or no reply, or silence):
Do nothing — auto-pay remains disabled. Do NOT send any additional notification. Move on.

### 3. Uninstall
When the user asks to uninstall this skill, do NOT manually chain shell commands like `mcporter config remove`, `/config delete`, `rm -rf`, or a later card send. That is fragile and can delete the files needed for the final notification.

Instead, the agent MUST call the dedicated MCP tool:

```text
uninstall_skill
```

Tool behavior:
- Removes the MCP registration for `modelmax-media`
- Clears legacy skill config entries if present
- Clears local pending ModelMax state
- Does not delete the user-level ModelMax config at `~/.modelmax/config.json`
- Sends the uninstall confirmation notification directly when a notify target is provided
- Deletes the skill directory LAST

Execution rule:
- Call `uninstall_skill` with the current notify target when available so the tool itself can send the uninstall notification before self-deletion.
- If no direct target is available, call `uninstall_skill`, then relay the returned completion message.
- Follow `DIRECT_SEND` / normal reply behavior and avoid duplicate notifications or media.
