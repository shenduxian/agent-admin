# agent-admin

> 中文文档见 [`readme-zh.md`](./readme-zh.md)

A macOS command-line tool to manage locally installed AI coding agents
(Claude Code, Cursor, OpenAI Codex CLI, Gemini CLI, Aider, GitHub Copilot
CLI, Continue, Crush, opencode, Trae CLI, …) along with their runtime dependencies,
configuration files, MCP servers, and API keys — all from one place.

## Why

If you use more than one AI coding assistant you quickly end up with:

- multiple binaries scattered across `npm`, `pipx`, `brew`, and `.app` bundles
- per-agent config dirs (`~/.claude`, `~/.cursor`, `~/.codex`, `~/.gemini` …)
- a few different MCP-server formats (JSON, TOML, YAML)
- API keys spread across shell rc files and OS keychains

`agent-admin` gives you one CLI to detect what is installed, what is missing,
and where every agent stores its state, without trying to be a package
manager itself — package installs stay with `npm`, `pipx`, or `brew`.

## Install (from source)

Requires Node.js >= 18.

```bash
git clone https://github.com/shenduxian/agent-admin.git
cd agent-admin
npm install
npm link        # exposes `agent-admin` and the `aa` alias on your PATH
```

## Commands

```text
agent-admin list                  # which agents are installed
agent-admin info <agent>          # detailed status for one agent
agent-admin doctor                # runtime + credential health check
agent-admin config show <agent>   # config file paths for one agent
agent-admin config paths          # every known config path (for backups)
agent-admin mcp list              # MCP servers across all agents
agent-admin mcp show <agent>      # MCP servers for one agent
agent-admin creds status          # which API key env vars are set (masked)
agent-admin registry              # every agent id this tool knows about
```

Every command that prints a table also accepts `--json` for scripting.

## Tests

```bash
npm test     # node --test, no extra deps
```

Covers the registry shape, the detection cascade (bin / .app / leftover
config), runtime + credential checks, the JSON/TOML/YAML MCP parsers, and
the CLI end-to-end (output, `--json`, exit codes, credential masking).

## Supported agents (initial)

| id           | name                  |
|--------------|-----------------------|
| claude-code  | Claude Code           |
| cursor       | Cursor                |
| codex        | OpenAI Codex CLI      |
| gemini       | Gemini CLI            |
| aider        | Aider                 |
| gh-copilot   | GitHub Copilot CLI    |
| continue     | Continue              |
| crush        | Charm Crush           |
| opencode     | opencode              |
| trae-cli     | Trae CLI (ByteDance)  |

`trae-cli` keeps its data under `~/.coco` (with `~/.trae` / `~/.trae-agent`
also checked); since `docs.trae.cn/cli` is CDN-gated, the exact filenames
under `~/.coco` are a best-effort guess — only the dir and the
`npm i -g trae-cli` install are confirmed. Correct them in `src/registry.js`
if you know better.

Add more by editing `src/registry.js` — each entry is plain data.

### Multiple copies of the same agent

`list`, `info`, and `doctor` collect *every* match for an agent's binary on
`PATH` (via `which -a`), not just the first one. So if you have, say, a brew
build, an npm-global install, and an nvm-managed copy all called `claude`,
you'll see a `(+N more)` marker in `list` and the full list — with each
copy's reported version — in `info`. The first entry is the one your shell
actually runs.

## Design notes

- **Read-only.** This release detects and reports; it never mutates agent
  config or runs installers. Install / uninstall commands are the natural
  next step but are intentionally out of scope for v0.1 so the surface area
  stays small and safe to run.
- **macOS first.** Paths and install hints assume macOS. The detection
  primitives (`which`, file existence) work elsewhere, but the install
  hints would need a per-OS map first.
- **No native deps.** Pure JS so `npm install` is fast and works offline if
  the `chalk` / `commander` tarballs are cached.
