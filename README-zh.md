# ModelMax Skills

[English](README.md) | 简体中文

ModelMax Skills 可以为 OpenClaw Agent 增加图片生成、视频生成、余额查询和可选的自动充值能力。

---

## 能做什么

安装后，你可以直接让 Agent：

- 根据文本提示生成图片
- 根据文本提示或输入图片生成视频
- 查询当前 ModelMax 余额
- 在余额不足时自动充值并恢复任务

示例：

- `帮我生成一张赛博朋克风格的猫`
- `生成一个 8 秒 1080p 的日落视频`
- `用这张图做首帧，生成一个 16:9 视频`
- `看看我的 ModelMax 余额`

---

## 视频限制

- 默认分辨率：`720p`
- 支持分辨率：`720p`、`1080p`、`4k`
- `1080p` 和 `4k` 必须使用 `8 秒`
- 支持画幅：`16:9`、`9:16`

---

## 安装

### 让 Agent 自动安装

```text
帮我安装 ModelMax Skills：https://github.com/modelmaxio/skills
```

安装完成后，Agent 会继续引导你完成激活。

### 手动安装

```bash
git clone https://github.com/modelmaxio/skills.git
cd skills
cd skills/media-generation/scripts
mkdir -p "$HOME/.modelmax"
npx mcporter --config "$HOME/.modelmax/mcporter.json" config add modelmax-media "node $(pwd)/index.bundle.mjs"
```

仓库里已经带了打包产物 `index.bundle.mjs`，安装时不需要再执行 `npm install`。

### Installation for OpenClaw

如果你是给 OpenClaw 安装，请把 Skill 放到 OpenClaw 托管的 `skills` 目录下，不要把整个仓库直接 clone 到 `~/.openclaw/workspace`：

```bash
TARGET_DIR="${OPENCLAW_HOME:-$HOME}/.openclaw/workspace/skills/modelmax-media"

mkdir -p "$(dirname "$TARGET_DIR")"
rm -rf "$TARGET_DIR"
cp -R skills/media-generation "$TARGET_DIR"

cd "$TARGET_DIR"
node scripts/pre_install.mjs --channel <CHANNEL> --target-id <TARGET_ID> --target-type <TARGET_TYPE>
```

不要把整个仓库直接 clone 到 `~/.openclaw/workspace/`。对于 OpenClaw，只应把 `skills/media-generation` 复制到 `~/.openclaw/workspace/skills/modelmax-media`。

如果是飞书，请使用以下其中一种：

```bash
node scripts/pre_install.mjs --channel feishu --target-id <CHAT_ID> --target-type chat_id
node scripts/pre_install.mjs --channel feishu --target-id <OPEN_ID> --target-type open_id
```

`pre_install.mjs` 会立即完成 MCP 注册并发送安装成功通知，不会等待后续的重启成功卡片。

---

## 激活

使用前需要先准备好 ModelMax API Key。

### 推荐方式

直接把 ModelMax API Key 发给 Agent。

### ModelMax 本地配置

在已安装的 Skill 目录（`~/.openclaw/workspace/skills/modelmax-media`）下执行：

```bash
node scripts/set-api-key.mjs sk-xxxx
```

这个命令会把 Key 写入 `~/.modelmax/config.json`，不会写到 `openclaw.json`。

`MODELMAX_AUTO_PAY` 也会存储在同一个本地 `~/.modelmax/config.json` 中。

### 环境变量

```bash
export MODELMAX_API_KEY="sk-xxxx"
```

---

## 自动充值

自动充值依赖：

- [agent-payment-skills](https://github.com/clinkbillcom/agent-payment-skills)

开启后，当余额不足时，Agent 可以自动完成充值并继续原来的生成任务。

金额规则：

- 如果你在当前这次明确指定了充值金额，优先使用你的金额
- 如果你没有指定金额，则使用商户默认金额

---

## 常见用法

### 图片生成

- `帮我生成一张赛博朋克风格的猫`
- `生成一张极简风格的产品海报`

### 视频生成

- `生成一个 8 秒 1080p 的日落视频`
- `用这张图生成一个竖版 9:16 视频`

### 余额查询

- `看看我的 ModelMax 余额`

### 自动充值

- `开启自动充值`
- 也支持你当前语言里的等价表达

---

## 更新

```text
帮我更新 ModelMax Skills：https://github.com/modelmaxio/skills
```

## 卸载

```text
帮我卸载 ModelMax Skills
```

---

## 兼容环境

- OpenClaw

---

## License

MIT
