# ModelMax Skills

[English](README.md) | 简体中文

ModelMax Skills 可以为支持通过 mcporter 调用 MCP 工具的 Agent 增加图片生成、视频生成、余额查询和可选的自动充值能力。

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

### Agent 托管安装

如果你的 Agent 会托管 Skill，请只把 `skills/media-generation` 复制到该 Agent 自己的 skill 目录，然后在安装后的 skill 目录里运行预安装脚本。具体 skill 目录由当前 Agent 决定。

```bash
TARGET_DIR="$HOME/.modelmax/workspace/skills/modelmax-media"

mkdir -p "$(dirname "$TARGET_DIR")"
rm -rf "$TARGET_DIR"
cp -R skills/media-generation "$TARGET_DIR"

cd "$TARGET_DIR"
node scripts/pre_install.mjs --channel <CHANNEL> --target-id <TARGET_ID> --target-type <TARGET_TYPE>
```

不要把整个仓库直接 clone 到 Agent workspace。只复制 `skills/media-generation` 这个 skill 目录。

`--channel`、`--target-id`、`--target-type` 是可选的路由提示。`pre_install.mjs` 会完成 MCP 注册，并只在 stdout 输出安装成功通知 JSON payload。当前 agent/runtime 应使用自己的消息能力发送该 payload。

---

## 激活

使用前需要先准备好 ModelMax API Key。

### 推荐方式

直接把 ModelMax API Key 发给 Agent。

### ModelMax 本地配置

在已安装的 Skill 目录下执行：

```bash
node scripts/set-api-key.mjs sk-xxxx
```

这个命令会把 Key 写入 `~/.modelmax/config.json`。

`MODELMAX_AUTO_PAY` 也会存储在同一个本地 `~/.modelmax/config.json` 中。

### 环境变量

```bash
export MODELMAX_API_KEY="sk-xxxx"
```

---

## 自动充值

自动充值依赖：

- 当前 Agent/runtime 暴露的 Clink 支付能力，例如 `agent-payment-skills` MCP server 或 `clink-payment-skill` CLI workflow

开启后，当余额不足时，Agent 可以自动完成充值并继续原来的生成任务。

金额规则：

- 如果你在当前这次明确指定了充值金额，优先使用你的金额
- 如果你没有指定金额，则使用商户默认金额

支付方式规则：

- 如果你在当前这次明确选择支付宝，ModelMax 会向 Clink 支付运行时透传 `ALIPAY`
- 如果你没有选择支付方式，则保持原有默认支付逻辑

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

### 手动充值

- `用支付宝给 ModelMax 充值 1 美元`

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

- 任何可以通过 mcporter 注册并调用 MCP 工具的 Agent/runtime
- 通知 payload 发送和生成文件投递由当前 Agent/runtime 自己负责

---

## License

MIT
