'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'bin', 'agent-admin.js');

function run(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...(opts.env || {}) },
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: (err.stdout || '').toString(), stderr: (err.stderr || '').toString() };
  }
}

test('--version prints the package version', () => {
  const { code, stdout } = run(['--version']);
  assert.equal(code, 0);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('--help lists the top-level commands', () => {
  const { code, stdout } = run(['--help']);
  assert.equal(code, 0);
  for (const cmd of ['list', 'info', 'doctor', 'config', 'mcp', 'creds', 'registry']) {
    assert.ok(stdout.includes(cmd), `help should mention "${cmd}"`);
  }
});

test('registry --json returns every known agent id', () => {
  const { code, stdout } = run(['registry', '--json']);
  assert.equal(code, 0);
  const data = JSON.parse(stdout);
  const ids = data.map((a) => a.id).sort();
  assert.deepEqual(ids, [
    'aider',
    'claude-code',
    'codex',
    'continue',
    'crush',
    'cursor',
    'gemini',
    'gh-copilot',
    'opencode',
    'trae-cli',
  ]);
});

test('list --json returns a status object per agent with stable keys', () => {
  const { code, stdout } = run(['list', '--json']);
  assert.equal(code, 0);
  const rows = JSON.parse(stdout);
  assert.equal(rows.length, 10);
  for (const r of rows) {
    assert.ok(typeof r.id === 'string');
    assert.ok(typeof r.installed === 'boolean');
    assert.ok(Array.isArray(r.configPresent));
  }
});

test('list --installed only returns installed agents', () => {
  const { code, stdout } = run(['list', '--installed', '--json']);
  assert.equal(code, 0);
  const rows = JSON.parse(stdout);
  for (const r of rows) assert.equal(r.installed, true);
});

test('doctor --json reports runtimes and agents', () => {
  const { code, stdout } = run(['doctor', '--all', '--json']);
  assert.equal(code, 0);
  const report = JSON.parse(stdout);
  assert.ok(Array.isArray(report.runtimes));
  assert.equal(report.runtimes.length, 3);
  assert.ok(Array.isArray(report.agents));
  assert.equal(report.agents.length, 10);
});

test('info <agent> --json includes config, runtimes, mcp, credentials', () => {
  const { code, stdout } = run(['info', 'claude-code', '--json']);
  assert.equal(code, 0);
  const d = JSON.parse(stdout);
  assert.equal(d.id, 'claude-code');
  assert.ok(Array.isArray(d.configPaths));
  assert.ok(Array.isArray(d.runtimes));
  assert.ok(Array.isArray(d.mcpServers));
  assert.ok(Array.isArray(d.binPaths));
  assert.equal(typeof d.multipleInstalls, 'boolean');
  assert.ok(d.credentials && Array.isArray(d.credentials.env));
});

test('info trae-cli --json works and points at the .coco data dir', () => {
  const { code, stdout } = run(['info', 'trae-cli', '--json']);
  assert.equal(code, 0);
  const d = JSON.parse(stdout);
  assert.equal(d.id, 'trae-cli');
  assert.ok(d.configPaths.some((c) => c.path.endsWith('/.coco')));
});

test('info accepts dash-insensitive / display-name lookups', () => {
  assert.equal(run(['info', 'claudecode', '--json']).code, 0);
  assert.equal(JSON.parse(run(['info', 'claudecode', '--json']).stdout).id, 'claude-code');
});

test('unknown agent exits with code 2', () => {
  const { code, stderr } = run(['info', 'no-such-agent']);
  assert.equal(code, 2);
  assert.match(stderr, /unknown agent/);
});

test('creds status --json is not a command (only text) but creds status --all runs', () => {
  // `creds status` is text-only; just assert it exits cleanly.
  const { code } = run(['creds', 'status', '--all']);
  assert.equal(code, 0);
});

test('credential env values are masked, never printed verbatim', () => {
  const secret = 'sk-supersecretvalue-1234567890';
  const { code, stdout } = run(['info', 'claude-code', '--json'], { env: { ANTHROPIC_API_KEY: secret } });
  assert.equal(code, 0);
  assert.ok(!stdout.includes(secret), 'raw secret must not appear in output');
  const d = JSON.parse(stdout);
  const entry = d.credentials.env.find((e) => e.name === 'ANTHROPIC_API_KEY');
  assert.equal(entry.set, true);
  assert.ok(entry.preview && !entry.preview.includes('supersecret'));
});

test('config paths --existing emits tab-separated rows', () => {
  const { code, stdout } = run(['config', 'paths']);
  assert.equal(code, 0);
  // every non-empty line should have: <agent-id>\t<+|->\t<path>
  for (const line of stdout.split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    assert.equal(parts.length, 3, `bad row: ${JSON.stringify(line)}`);
    assert.ok(['+', '-'].includes(parts[1]));
  }
});

test('mcp list --json returns an array', () => {
  const { code, stdout } = run(['mcp', 'list', '--json']);
  assert.equal(code, 0);
  assert.ok(Array.isArray(JSON.parse(stdout)));
});
