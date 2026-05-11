'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { detectAgent, detectAll } = require('../src/detect');
const { AGENTS } = require('../src/registry');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-admin-test-'));
}

test('detectAll returns one status per registered agent', () => {
  const all = detectAll();
  assert.equal(all.length, AGENTS.length);
  for (const s of all) {
    assert.ok('installed' in s);
    assert.ok('configPresent' in s);
  }
});

test('an agent with no bin and no config is reported as not installed', () => {
  const status = detectAgent({
    id: 'ghost',
    name: 'Ghost',
    kind: 'cli',
    bins: ['definitely-not-a-real-binary-xyz'],
    configPaths: ['/nonexistent/path/that/should/not/exist'],
    runtimes: [],
  });
  assert.equal(status.installed, false);
  assert.equal(status.binPath, null);
  assert.deepEqual(status.configPresent, []);
});

test('an agent with a present config dir but no bin is reported as partial', () => {
  const dir = tmpdir();
  try {
    const cfg = path.join(dir, 'config.json');
    fs.writeFileSync(cfg, '{}');
    const status = detectAgent({
      id: 'leftover',
      name: 'Leftover',
      kind: 'cli',
      bins: ['definitely-not-a-real-binary-xyz'],
      configPaths: [dir, cfg],
      runtimes: [],
    });
    assert.equal(status.installed, true);
    assert.equal(status.partial, true);
    assert.deepEqual(status.configPresent, [dir, cfg]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an agent whose bin resolves on PATH is reported as installed with a version', () => {
  // `node` is guaranteed to be on PATH while these tests run.
  const status = detectAgent({
    id: 'node-as-agent',
    name: 'Node',
    kind: 'cli',
    bins: ['node'],
    versionArgs: ['--version'],
    configPaths: [],
    runtimes: [],
  });
  assert.equal(status.installed, true);
  assert.ok(status.binPath && status.binPath.length > 0);
  assert.match(status.version, /^v?\d+\.\d+\.\d+/);
  assert.notEqual(status.partial, true);
});

test('detectAgent reports multiple installs when a bin appears twice on PATH', () => {
  const a = tmpdir();
  const b = tmpdir();
  const origPath = process.env.PATH;
  try {
    for (const d of [a, b]) {
      const f = path.join(d, 'faketool');
      fs.writeFileSync(f, '#!/bin/sh\necho "faketool 1.2.3"\n');
      fs.chmodSync(f, 0o755);
    }
    process.env.PATH = `${a}:${b}:${origPath}`;
    const status = detectAgent({
      id: 'ft',
      name: 'FakeTool',
      kind: 'cli',
      bins: ['faketool'],
      versionArgs: ['--version'],
      configPaths: [],
      runtimes: [],
    });
    assert.equal(status.installed, true);
    assert.equal(status.multipleInstalls, true);
    assert.equal(status.binPaths.length, 2);
    assert.equal(status.binPath, path.join(a, 'faketool'));
    assert.equal(status.version, 'faketool 1.2.3');
    assert.deepEqual(status.binPaths.map((x) => x.path), [path.join(a, 'faketool'), path.join(b, 'faketool')]);
  } finally {
    process.env.PATH = origPath;
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  }
});

test('detectAgent does not flag multipleInstalls for a single copy', () => {
  const status = detectAgent({
    id: 'node-as-agent',
    name: 'Node',
    kind: 'cli',
    bins: ['node'],
    versionArgs: ['--version'],
    configPaths: [],
    runtimes: [],
  });
  // there may legitimately be >1 node on PATH in some envs; only assert the
  // flag is a boolean consistent with binPaths length.
  assert.equal(status.multipleInstalls, status.binPaths.length > 1);
});

test('an agent with an existing appPath is reported as installed', () => {
  const dir = tmpdir();
  try {
    const app = path.join(dir, 'Fake.app');
    fs.mkdirSync(app);
    const status = detectAgent({
      id: 'fake-desktop',
      name: 'Fake Desktop',
      kind: 'desktop',
      bins: [],
      appPaths: [app, '/Applications/DoesNotExist.app'],
      configPaths: [],
      runtimes: [],
    });
    assert.equal(status.installed, true);
    assert.equal(status.appPath, app);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
