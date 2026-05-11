'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AGENTS, RUNTIMES, findAgent } = require('../src/registry');

test('registry exposes the expected set of agents', () => {
  const ids = AGENTS.map((a) => a.id).sort();
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

test('every agent entry has the required shape', () => {
  for (const a of AGENTS) {
    assert.ok(a.id && typeof a.id === 'string', `id missing on ${JSON.stringify(a)}`);
    assert.ok(a.name && typeof a.name === 'string', `name missing on ${a.id}`);
    assert.ok(['cli', 'desktop', 'plugin'].includes(a.kind), `bad kind on ${a.id}`);
    assert.ok(Array.isArray(a.bins), `bins not array on ${a.id}`);
    assert.ok(Array.isArray(a.configPaths), `configPaths not array on ${a.id}`);
    assert.ok(Array.isArray(a.runtimes), `runtimes not array on ${a.id}`);
    assert.ok(typeof a.installHint === 'string' && a.installHint.length > 0, `installHint missing on ${a.id}`);
    for (const r of a.runtimes) {
      assert.ok(RUNTIMES[r], `agent ${a.id} references unknown runtime ${r}`);
    }
  }
});

test('agent ids are unique', () => {
  const ids = AGENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('findAgent resolves by id, name, and dash-insensitively', () => {
  assert.equal(findAgent('claude-code').id, 'claude-code');
  assert.equal(findAgent('Claude Code').id, 'claude-code');
  assert.equal(findAgent('claudecode').id, 'claude-code');
  assert.equal(findAgent('GH-Copilot').id, 'gh-copilot');
  assert.equal(findAgent('trae-cli').id, 'trae-cli');
  assert.equal(findAgent('Trae CLI').id, 'trae-cli');
  assert.equal(findAgent(''), undefined);
  assert.equal(findAgent('does-not-exist'), undefined);
});

test('known runtimes have a bin and install hint', () => {
  for (const [key, spec] of Object.entries(RUNTIMES)) {
    assert.ok(spec.bin, `runtime ${key} has no bin`);
    assert.ok(spec.install, `runtime ${key} has no install hint`);
  }
});
