# ModelMax Skills

English | [简体中文](README-zh.md)

ModelMax Skills adds image generation, video generation, balance checks, and optional auto top-up to OpenClaw agents.

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

### Installation for OpenClaw

Install the skill into OpenClaw's managed skills directory instead of cloning the whole repo into `~/.openclaw/workspace`:

```bash
TARGET_DIR="${OPENCLAW_HOME:-$HOME}/.openclaw/workspace/skills/modelmax-media"

mkdir -p "$(dirname "$TARGET_DIR")"
rm -rf "$TARGET_DIR"
cp -R skills/media-generation "$TARGET_DIR"

cd "$TARGET_DIR"
node scripts/pre_install.mjs --channel <CHANNEL> --target-id <TARGET_ID> --target-type <TARGET_TYPE>
```

Do not clone this repo directly into `~/.openclaw/workspace/`. For OpenClaw, only copy `skills/media-generation` into `~/.openclaw/workspace/skills/modelmax-media`.

For Feishu, use one of:

```bash
node scripts/pre_install.mjs --channel feishu --target-id <CHAT_ID> --target-type chat_id
node scripts/pre_install.mjs --channel feishu --target-id <OPEN_ID> --target-type open_id
```

`pre_install.mjs` registers the MCP server and sends the install success notification immediately. It does not wait for any later restart-success card.

---

## Activate

You need a ModelMax API key before using the skill.

### Recommended

Send your ModelMax API key directly to the agent.

### Local ModelMax Config

From the installed skill directory (`~/.openclaw/workspace/skills/modelmax-media`), run:

```bash
node scripts/set-api-key.mjs sk-xxxx
```

This writes the key into `~/.modelmax/config.json` instead of `openclaw.json`.

`MODELMAX_AUTO_PAY` is also stored in the same local `~/.modelmax/config.json`.

### Environment Variable

```bash
export MODELMAX_API_KEY="sk-xxxx"
```

---

## Auto Top-Up

Auto top-up requires:

- [agent-payment-skills](https://github.com/clinkbillcom/agent-payment-skills)

When enabled, the agent can recharge automatically and continue the original generation task.

Amount rules:

- If you explicitly provide a recharge amount in the current turn, that amount is used
- Otherwise, the system uses the merchant default amount

Payment method rules:

- If you explicitly choose Alipay in the current turn, ModelMax passes `ALIPAY` to the Clink payment runtime
- If you do not choose a payment method, the existing default payment behavior remains unchanged

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

### Manual Recharge

- `Recharge ModelMax with 1 USD using Alipay`

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

- OpenClaw

---

## License

MIT
