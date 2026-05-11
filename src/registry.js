'use strict';

const path = require('path');
const os = require('os');

const home = os.homedir();
const hp = (...p) => path.join(home, ...p);

/**
 * Each entry describes a known AI coding agent.
 *
 *   id            stable short id used on the CLI
 *   name          display name
 *   kind          'cli' | 'desktop' | 'plugin'
 *   bins          executables to look up on PATH (first hit wins)
 *   versionArgs   args appended to the bin to print version (default: ['--version'])
 *   appPaths      macOS .app bundles (any-existence counts as installed)
 *   configPaths   user-level config files / dirs to surface in `config show`
 *   mcpPaths      MCP server config files (Claude Code / Cursor style JSON)
 *   credsEnv      env vars commonly used as API keys
 *   credsFiles    on-disk credential stores (informational only — never printed)
 *   installHint   one-liner shown by `doctor` when missing
 *   runtimes      runtime deps required to run the agent ('node', 'python', 'git')
 */
const AGENTS = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    kind: 'cli',
    bins: ['claude'],
    versionArgs: ['--version'],
    configPaths: [hp('.claude.json'), hp('.claude'), hp('.claude', 'settings.json')],
    mcpPaths: [hp('.claude.json'), hp('.claude', 'settings.json')],
    credsEnv: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'],
    credsFiles: [hp('.claude', '.credentials.json')],
    installHint: 'npm install -g @anthropic-ai/claude-code',
    runtimes: ['node'],
    docs: 'https://docs.claude.com/claude-code',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    kind: 'desktop',
    bins: ['cursor'],
    versionArgs: ['--version'],
    appPaths: ['/Applications/Cursor.app'],
    configPaths: [hp('.cursor'), hp('Library/Application Support/Cursor/User/settings.json')],
    mcpPaths: [hp('.cursor', 'mcp.json')],
    credsEnv: [],
    installHint: 'Download from https://cursor.com',
    runtimes: [],
  },
  {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    kind: 'cli',
    bins: ['codex'],
    versionArgs: ['--version'],
    configPaths: [hp('.codex'), hp('.codex', 'config.toml')],
    mcpPaths: [hp('.codex', 'config.toml')],
    credsEnv: ['OPENAI_API_KEY'],
    credsFiles: [hp('.codex', 'auth.json')],
    installHint: 'npm install -g @openai/codex',
    runtimes: ['node'],
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    kind: 'cli',
    bins: ['gemini'],
    versionArgs: ['--version'],
    configPaths: [hp('.gemini'), hp('.gemini', 'settings.json')],
    mcpPaths: [hp('.gemini', 'settings.json')],
    credsEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    installHint: 'npm install -g @google/gemini-cli',
    runtimes: ['node'],
  },
  {
    id: 'aider',
    name: 'Aider',
    kind: 'cli',
    bins: ['aider'],
    versionArgs: ['--version'],
    configPaths: [hp('.aider.conf.yml'), hp('.aider.model.settings.yml')],
    credsEnv: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
    installHint: 'pipx install aider-chat  # or: brew install aider',
    runtimes: ['python'],
  },
  {
    id: 'gh-copilot',
    name: 'GitHub Copilot CLI',
    kind: 'plugin',
    bins: ['gh'],
    versionArgs: ['copilot', '--version'],
    configPaths: [hp('.config/gh')],
    credsEnv: ['GITHUB_TOKEN'],
    installHint: 'brew install gh && gh extension install github/gh-copilot',
    runtimes: [],
  },
  {
    id: 'continue',
    name: 'Continue',
    kind: 'plugin',
    bins: [],
    configPaths: [hp('.continue'), hp('.continue', 'config.json'), hp('.continue', 'config.yaml')],
    mcpPaths: [hp('.continue', 'config.yaml')],
    credsEnv: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
    installHint: 'Install the Continue extension in VS Code / JetBrains',
    runtimes: [],
  },
  {
    id: 'crush',
    name: 'Charm Crush',
    kind: 'cli',
    bins: ['crush'],
    versionArgs: ['--version'],
    configPaths: [hp('.config/crush')],
    credsEnv: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
    installHint: 'brew install charmbracelet/tap/crush',
    runtimes: [],
  },
  {
    id: 'opencode',
    name: 'opencode',
    kind: 'cli',
    bins: ['opencode'],
    versionArgs: ['--version'],
    configPaths: [hp('.config/opencode'), hp('.local/share/opencode')],
    credsEnv: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
    installHint: 'curl -fsSL https://opencode.ai/install | bash',
    runtimes: [],
  },
  {
    // ByteDance Trae's agentic CLI (docs.trae.cn/cli). Note: the upstream docs
    // page is geo/CDN-gated, so the exact on-disk filenames below are
    // best-effort — the `~/.coco` data dir and `npm i -g trae-cli` install are
    // the reliably-confirmed bits. `trae` also doubles as the IDE launcher
    // (like `code`), which is why the .app bundles count toward detection.
    id: 'trae-cli',
    name: 'Trae CLI',
    kind: 'cli',
    bins: ['trae', 'trae-cli'],
    versionArgs: ['--version'],
    appPaths: ['/Applications/Trae.app', '/Applications/Trae CN.app'],
    configPaths: [
      hp('.coco'),
      hp('.coco', 'config.json'),
      hp('.coco', 'settings.json'),
      hp('.trae'),
      hp('.trae-agent'),
    ],
    mcpPaths: [hp('.coco', 'mcp.json'), hp('.coco', 'config.json')],
    credsEnv: ['TRAE_API_KEY'],
    credsFiles: [hp('.coco', 'auth.json'), hp('.coco', 'credentials.json')],
    installHint: 'npm install -g trae-cli',
    runtimes: ['node'],
    docs: 'https://docs.trae.cn/cli/get-started-with-trae-cli',
  },
];

/**
 * Known runtimes; surfaced in `doctor` when an agent depends on them.
 */
const RUNTIMES = {
  node: { bin: 'node', versionArgs: ['--version'], install: 'brew install node' },
  python: { bin: 'python3', versionArgs: ['--version'], install: 'brew install python' },
  git: { bin: 'git', versionArgs: ['--version'], install: 'brew install git' },
};

function findAgent(idOrName) {
  const q = String(idOrName || '').toLowerCase();
  return AGENTS.find(
    (a) => a.id === q || a.name.toLowerCase() === q || a.id.replace(/-/g, '') === q.replace(/-/g, ''),
  );
}

module.exports = { AGENTS, RUNTIMES, findAgent };
