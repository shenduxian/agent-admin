# agent-admin

一个 macOS 命令行工具,用于统一管理本机安装的各种 AI 编码 agent
(Claude Code、Cursor、OpenAI Codex CLI、Gemini CLI、Aider、GitHub
Copilot CLI、Continue、Crush、opencode、Trae CLI 等),以及它们的运行时依赖、
配置文件、MCP server 和 API key —— 一个 CLI 全部搞定。

> English version: see [`README.md`](./README.md)

## 为什么需要它

如果你同时用了不止一个 AI 编码助手,很快就会遇到:

- 二进制散落在 `npm`、`pipx`、`brew` 和 `.app` 各处
- 每个 agent 各自的配置目录(`~/.claude`、`~/.cursor`、`~/.codex`、`~/.gemini` …)
- 几种不同的 MCP server 配置格式(JSON、TOML、YAML)
- API key 分散在 shell 配置文件和系统钥匙串里

`agent-admin` 给你一个统一入口:看清楚装了什么、缺了什么、每个 agent 的状态文件在哪里。
它**不取代包管理器** —— 安装/卸载仍然交给 `npm`、`pipx` 或 `brew`。

## 安装(从源码)

需要 Node.js >= 18。

```bash
git clone https://github.com/shenduxian/agent-admin.git
cd agent-admin
npm install
npm link        # 把 `agent-admin` 和别名 `aa` 注册到 PATH
```

## 命令一览

```text
agent-admin list                  # 哪些 agent 已安装
agent-admin info <agent>          # 单个 agent 的详细状态
agent-admin doctor                # 体检:运行时 + 凭证
agent-admin config show <agent>   # 单个 agent 的配置文件路径
agent-admin config paths          # 所有已知配置路径(方便备份脚本)
agent-admin mcp list              # 跨所有 agent 的 MCP server
agent-admin mcp show <agent>      # 单个 agent 的 MCP server
agent-admin creds status          # 哪些 API key 环境变量已设置(脱敏显示)
agent-admin registry              # 本工具认识的所有 agent id
```

所有打印表格的命令都支持 `--json`,方便脚本调用。每个命令和子命令都有 `--help`
(如 `agent-admin config show --help`)。输入了不存在的 agent / 命令 / 选项时会给
"你是不是想输入 …?" 的提示。

## 命令详解

### `list`(别名 `ls`)
扫描本机,列出每个已知 agent 是否安装、版本号、路径。

- `--installed` 只显示检测到已安装的
- `--json` 机器可读输出

状态标记:`✓` 已安装、`~` 部分安装(只剩配置残留)、`·` 未安装。

### `info <agent>`
单个 agent 的完整信息:版本、二进制路径、`.app` 路径、文档链接、
配置文件清单(存在/缺失、是目录还是文件)、运行时依赖检查、
已配置的 MCP server、凭证状态(环境变量 + 凭证文件,值会脱敏)。
未安装时会给出安装提示。

### `doctor`
对**已安装**的 agent 做体检:先检查 node / python / git 运行时,
再逐个 agent 列出它需要的运行时是否就绪、凭证环境变量是否设置。
加 `-a, --all` 可检查所有已知 agent(不只是已安装的)。

### `config show <agent>` / `config paths`
`config show` 列出某个 agent 用到的配置文件/目录及其存在状态。
`config paths` 把所有 agent 的所有已知配置路径以 `id<TAB>+|-<TAB>路径` 的格式输出,
适合写进备份脚本;`--existing` 只输出当前存在的路径。

### `mcp list` / `mcp show <agent>`
扫描各 agent 配置,提取已配置的 MCP server,统一展示成一张表。
支持三种格式:Claude Code / Cursor 的 JSON、Codex 的 TOML、Continue 的 YAML。
每条记录包含名称、类型(stdio / http / …)、启动命令或 endpoint、以及来源文件路径。

### `creds status`
列出每个 agent 用到的 API key 环境变量是否已设置,值做脱敏处理
(只显示前 4 后 4 字符,例如 `sk-a…5678 (40 chars)`),
同时报告磁盘上的凭证文件是否存在(**只报告存在性,绝不读取或打印内容**)。
加 `-a, --all` 包含未安装的 agent。

### `registry`
列出本工具内置认识的所有 agent id(纯数据,见下文)。

## 当前支持的 agent

| id           | 名称                  | 检测方式 |
|--------------|-----------------------|----------|
| `claude-code`  | Claude Code           | `claude` 命令 + `~/.claude.json` / `~/.claude/` |
| `cursor`       | Cursor                | `cursor` 命令 + `/Applications/Cursor.app` + `~/.cursor/` |
| `codex`        | OpenAI Codex CLI      | `codex` 命令 + `~/.codex/` |
| `gemini`       | Gemini CLI            | `gemini` 命令 + `~/.gemini/` |
| `aider`        | Aider                 | `aider` 命令 + `~/.aider.conf.yml` |
| `gh-copilot`   | GitHub Copilot CLI    | `gh` 命令(`gh copilot --version`) |
| `continue`     | Continue              | `~/.continue/` 配置目录 |
| `crush`        | Charm Crush           | `crush` 命令 + `~/.config/crush` |
| `opencode`     | opencode              | `opencode` 命令 + `~/.config/opencode` |
| `trae-cli`     | Trae CLI(字节跳动)  | `trae` / `trae-cli` 命令 + `~/.coco` / `~/.trae` / `~/.trae-agent` + `/Applications/Trae.app` |

判定规则:**命令在 PATH 上 OR `.app` Bundle 存在 OR 已知配置目录存在** 即视为已安装;
若只剩配置残留(命令不在了)则标记为 `~ partial`。

> ⚠️ 关于 `trae-cli`:它的数据目录是 `~/.coco`(同时也会检查 `~/.trae`、`~/.trae-agent`)。
> 由于 `docs.trae.cn/cli` 有 CDN 访问限制,`~/.coco` 下的具体文件名(`config.json`、`auth.json` 等)
> 目前是**尽力推测**的,只有"目录是 `~/.coco`"和"`npm i -g trae-cli` 安装"是确认过的。
> 如果你知道准确路径,改 `src/registry.js` 里那一条即可。

想加新的 agent?编辑 `src/registry.js` 即可 —— 每个条目都是纯数据,不含逻辑。

### 同一个 agent 装了多个版本

`list`、`info`、`doctor` 会用 `which -a` 收集某个 agent 二进制在 `PATH` 上的**所有**匹配,
而不只是第一个。所以如果你同时有 brew 装的、npm 全局装的、nvm 管的好几份 `claude`,
`list` 里会看到 `(+N more)` 标记,`info` 里会列出全部路径(各自的版本号也会显示),
排在第一位的就是你 shell 实际会执行的那一份。

## 测试

```bash
npm test     # node --test,无额外依赖
```

覆盖:registry 结构、检测级联(命令 / `.app` / 残留配置)、运行时与凭证检查、
JSON/TOML/YAML 三种 MCP 解析器、以及 CLI 端到端测试(输出、`--json`、退出码、凭证脱敏)。

## 设计取舍

- **只读。** 当前版本只检测和报告,不会改任何 agent 的配置,也不会跑安装器。
  install / uninstall 之类的写操作是下一步要做的,但 v0.1 故意不做,
  保持功能面小、跑起来安全。
- **macOS 优先。** 路径和安装提示按 macOS 写。检测原语(`which`、文件存在性判断)
  在其他系统也能用,但安装提示需要先做一份按系统区分的映射表。
- **零原生依赖。** 纯 JS,`npm install` 很快,只依赖 `chalk` 和 `commander`。
