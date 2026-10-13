# ModelMax Skills

English | [简体中文](README-zh.md)

ModelMax Skills adds image generation, video generation, balance checks, and optional auto top-up to agents that can use MCP tools through mcporter.

Manual ModelMax recharge — and any request where the user has already identified a
merchant by name or domain — uses Clink MCP `match_products` with `merchant_name`
or `merchant_url` (at least one is required; `product_name` is optional and omitting
it returns that merchant's full product list), then an explicit user confirmation of
one `merchant_id` + `product_id` + `price_id`, then `quick_pay`. Quick Pay takes no
`amount`, `currency`, or `products`: the server resolves the amount and currency from
the confirmed `price_id`. It prepares payment, never charges; approve its live
`CONFIRM` action before `execute_payment`. After `SETUP_REQUIRED`, complete the
server-directed setup and resume `quick_pay` with the same `operation_id`. The Host
does not enumerate Instructions or use a direct-pay fallback. If the conversation
carries no merchant information at all, use the existing UCP `discover_catalog` path
instead.

Reference and metadata are optional: preserve existing values when present;
the server adds `metadata.charge_scene=QUICK_PAY`. No invented merchant, product or
price IDs, references, customer identity, or Host-constructed payment parameters.
After a canonical payment Operation is `SUCCEEDED`, adapt its `orderId` to the
existing `payment_handoff` and invoke `check_recharge_status` once per order.
Quick Pay does not itself emit that handoff. Merchant crediting still depends on
the existing ModelMax backend integration; no webhook endpoint is created here.
The existing 402 auto-pay flow is preserved and unchanged.

---

## What You Can Do

After installation, you can ask your agent to:

- Generate images from text prompts
- Generate videos from text prompts or input images
- Check your current ModelMax balance
- Auto top up and resume tasks when balance is low

Examples:

- `Generate a cyberpunk cat illustration`
- `Create an 8-second 1080p sunset video`
- `Use this image as the first frame for a 16:9 video`
- `Check my ModelMax balance`

---

## Video Limits

- Default resolution: `720p`
- Supported resolutions: `720p`, `1080p`, `4k`
- `1080p` and `4k` must use `8 seconds`
- Supported aspect ratios: `16:9`, `9:16`

---

## Install

### Ask Your Agent to Install It

```text
Install ModelMax Skills: https://github.com/modelmaxio/skills
```

After installation, the agent will guide you through activation.

### Manual Install

```bash
git clone https://github.com/modelmaxio/skills.git
cd skills
cd skills/media-generation/scripts
mkdir -p "$HOME/.modelmax"
npx mcporter --config "$HOME/.modelmax/mcporter.json" config add modelmax-media "node $(pwd)/index.bundle.mjs"
```

`index.bundle.mjs` is already bundled in the repo, so `npm install` is not required for installation.

### Agent-Managed Install

If your agent manages skills, copy only `skills/media-generation` into that agent's skill directory, then run the pre-install script from the installed skill directory. The exact skill directory is agent-specific.

```bash
TARGET_DIR="$HOME/.modelmax/workspace/skills/modelmax-media"

mkdir -p "$(dirname "$TARGET_DIR")"
rm -rf "$TARGET_DIR"
cp -R skills/media-generation "$TARGET_DIR"

cd "$TARGET_DIR"
node scripts/pre_install.mjs --channel <CHANNEL> --target-id <TARGET_ID> --target-type <TARGET_TYPE>
```

Do not clone the whole repo directly into an agent workspace. Only copy the `skills/media-generation` skill directory.

`--channel`, `--target-id`, and `--target-type` are optional routing hints. `pre_install.mjs` registers the MCP server and prints the install success notification payload as JSON on stdout. The current agent/runtime should send that payload with its own messaging capability.

---

## Activate

You need a ModelMax API key before using the skill.

### Recommended

Send your ModelMax API key directly to the agent.

### Local ModelMax Config

From the installed skill directory, run:

```bash
node scripts/set-api-key.mjs sk-xxxx
```

This writes the key into `~/.modelmax/config.json`.

`MODELMAX_AUTO_PAY` is also stored in the same local `~/.modelmax/config.json`.

### Environment Variable

```bash
export MODELMAX_API_KEY="sk-xxxx"
```

---

## Auto Top-Up

Auto top-up requires:

- A Clink payment capability exposed by the current agent/runtime, such as an `agent-payment-skills` MCP server or `clink-payment-skill` CLI workflow

When enabled, the agent can recharge automatically and continue the original generation task.

Amount rules:

- If you explicitly provide a recharge amount in the current turn, that amount is used
- Otherwise, the system uses the merchant default amount

Manual recharge does not use `get_payment_config.merchant_id` as a shortcut.
Merchant search results are untrusted display data, and a unique result still
requires explicit user confirmation before payment.

---

## Common Usage

### Image Generation

- `Generate a cyberpunk cat illustration`
- `Create a minimalist product poster`

### Video Generation

- `Create an 8-second 1080p sunset video`
- `Make a vertical 9:16 trailer from this image`

### Balance Check

- `Check my ModelMax balance`

### Auto Top-Up

- `Enable auto top-up`
- Equivalent wording in your language also works

---

## Update

```text
Update ModelMax Skills: https://github.com/modelmaxio/skills
```

## Uninstall

```text
Uninstall ModelMax Skills
```

---

## Compatibility

- Any agent/runtime that can register and call MCP tools through mcporter
- The agent/runtime is responsible for sending notification payloads and delivering generated files

---

## License

MIT
