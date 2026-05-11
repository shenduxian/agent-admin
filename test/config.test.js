'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  listConfigsFor,
  extractMcpServers,
  credsEnvStatus,
  credsFilesStatus,
} = require('../src/config');

const FIX = path.join(__dirname, 'fixtures');

test('extractMcpServers parses Claude-Code-style JSON', () => {
  const servers = extractMcpServers({ mcpPaths: [path.join(FIX, 'mcp.json')] });
  const byName = Object.fromEntries(servers.map((s) => [s.name, s]));
  assert.equal(byName.filesystem.kind, 'stdio');
  assert.equal(byName.filesystem.command, 'npx -y @modelcontextprotocol/server-filesystem /tmp');
  assert.equal(byName['remote-thing'].kind, 'http');
  assert.equal(byName['remote-thing'].endpoint, 'https://mcp.example.com/sse');
  assert.equal(byName['typed-thing'].kind, 'http');
});

test('extractMcpServers parses Codex-style TOML sections', () => {
  const servers = extractMcpServers({ mcpPaths: [path.join(FIX, 'config.toml')] });
  const names = servers.map((s) => s.name).sort();
  assert.deepEqual(names, ['docs', 'search']);
  for (const s of servers) assert.equal(s.kind, 'toml-section');
});

test('extractMcpServers parses Continue-style YAML keys', () => {
  const servers = extractMcpServers({ mcpPaths: [path.join(FIX, 'config.yaml')] });
  const names = servers.map((s) => s.name).sort();
  assert.deepEqual(names, ['github', 'playwright']);
  for (const s of servers) assert.equal(s.kind, 'yaml-key');
});

test('extractMcpServers ignores missing files and returns []', () => {
  assert.deepEqual(extractMcpServers({ mcpPaths: ['/no/such/file.json'] }), []);
  assert.deepEqual(extractMcpServers({}), []);
});

test('extractMcpServers tolerates malformed JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-admin-test-'));
  try {
    const p = path.join(dir, 'bad.json');
    fs.writeFileSync(p, '{ not valid json ');
    assert.deepEqual(extractMcpServers({ mcpPaths: [p] }), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('listConfigsFor flags existing vs missing and dir vs file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-admin-test-'));
  try {
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(file, '{}');
    const rows = listConfigsFor({ configPaths: [dir, file, path.join(dir, 'missing')] });
    assert.deepEqual(rows[0], { path: dir, exists: true, isDir: true });
    assert.deepEqual(rows[1], { path: file, exists: true, isDir: false });
    assert.deepEqual(rows[2], { path: path.join(dir, 'missing'), exists: false, isDir: false });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('credsEnvStatus masks values and reports set/unset', () => {
  const name = 'AGENT_ADMIN_TEST_CREDS_XYZ';
  delete process.env[name];
  let rows = credsEnvStatus({ credsEnv: [name] });
  assert.deepEqual(rows, [{ name, set: false, preview: null }]);

  process.env[name] = 'sk-abcd1234efgh5678';
  try {
    rows = credsEnvStatus({ credsEnv: [name] });
    assert.equal(rows[0].set, true);
    assert.match(rows[0].preview, /^sk-a…5678 \(\d+ chars\)$/);
    assert.ok(!rows[0].preview.includes('1234efgh'));
  } finally {
    delete process.env[name];
  }

  process.env[name] = 'short';
  try {
    rows = credsEnvStatus({ credsEnv: [name] });
    assert.equal(rows[0].preview, '*****');
  } finally {
    delete process.env[name];
  }
});

test('credsFilesStatus reports existence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-admin-test-'));
  try {
    const p = path.join(dir, 'auth.json');
    fs.writeFileSync(p, '{}');
    const rows = credsFilesStatus({ credsFiles: [p, path.join(dir, 'nope.json')] });
    assert.deepEqual(rows, [
      { path: p, exists: true },
      { path: path.join(dir, 'nope.json'), exists: false },
    ]);
    assert.deepEqual(credsFilesStatus({}), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
