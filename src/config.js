'use strict';

const fs = require('fs');
const path = require('path');
const { AGENTS, findAgent } = require('./registry');
const { pathExists, readJsonSafe, readTextSafe } = require('./utils');

function listConfigsFor(agent) {
  return (agent.configPaths || []).map((p) => ({
    path: p,
    exists: pathExists(p),
    isDir: pathExists(p) && safeIsDir(p),
  }));
}

function safeIsDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Best-effort MCP server extraction across the formats we know about today
 * (Claude Code / Cursor / Codex / Gemini / Continue). Returns an array of
 * { name, source, kind, command? } entries so the CLI can render a unified table.
 */
function extractMcpServers(agent) {
  const out = [];
  for (const p of agent.mcpPaths || []) {
    if (!pathExists(p)) continue;
    const ext = path.extname(p).toLowerCase();

    if (ext === '.json') {
      const data = readJsonSafe(p);
      if (!data) continue;
      const servers = data.mcpServers || data.mcp_servers || (data.mcp && data.mcp.servers) || null;
      if (servers && typeof servers === 'object') {
        for (const [name, cfg] of Object.entries(servers)) {
          out.push(buildEntry(name, p, cfg));
        }
      }
    } else if (ext === '.toml') {
      const text = readTextSafe(p);
      if (!text) continue;
      // Very small parser: just enumerate [mcp_servers.<name>] sections.
      // Good enough to surface presence; users edit via the agent's own tools.
      const re = /^\[(?:mcp[_.-]?servers)\.([A-Za-z0-9_.-]+)\]/gm;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ name: m[1], source: p, kind: 'toml-section' });
      }
    } else if (ext === '.yaml' || ext === '.yml') {
      const text = readTextSafe(p);
      if (!text) continue;
      // Naive scan for `mcpServers:` block; we don't pull in a YAML parser.
      const lines = text.split('\n');
      const idx = lines.findIndex((l) => /^mcpServers\s*:/.test(l));
      if (idx >= 0) {
        for (let i = idx + 1; i < lines.length; i++) {
          const l = lines[i];
          if (/^\S/.test(l)) break;
          const m = l.match(/^\s{2}([A-Za-z0-9_.-]+)\s*:/);
          if (m) out.push({ name: m[1], source: p, kind: 'yaml-key' });
        }
      }
    }
  }
  return out;
}

function buildEntry(name, source, cfg) {
  if (cfg && typeof cfg === 'object') {
    if (cfg.command) {
      return { name, source, kind: 'stdio', command: stringifyCommand(cfg) };
    }
    if (cfg.url || cfg.endpoint) {
      return { name, source, kind: 'http', endpoint: cfg.url || cfg.endpoint };
    }
    if (cfg.type) {
      return { name, source, kind: String(cfg.type) };
    }
  }
  return { name, source, kind: 'unknown' };
}

function stringifyCommand(cfg) {
  const parts = [cfg.command];
  if (Array.isArray(cfg.args)) parts.push(...cfg.args);
  return parts.join(' ');
}

function listAllMcp() {
  const result = [];
  for (const a of AGENTS) {
    const entries = extractMcpServers(a);
    if (entries.length) result.push({ agent: a.id, servers: entries });
  }
  return result;
}

function credsEnvStatus(agent) {
  return (agent.credsEnv || []).map((name) => {
    const v = process.env[name];
    return { name, set: Boolean(v), preview: v ? mask(v) : null };
  });
}

function mask(v) {
  if (!v) return null;
  if (v.length <= 8) return '*'.repeat(v.length);
  return `${v.slice(0, 4)}…${v.slice(-4)} (${v.length} chars)`;
}

function credsFilesStatus(agent) {
  return (agent.credsFiles || []).map((p) => ({ path: p, exists: pathExists(p) }));
}

module.exports = {
  listConfigsFor,
  extractMcpServers,
  listAllMcp,
  credsEnvStatus,
  credsFilesStatus,
  findAgent,
};
