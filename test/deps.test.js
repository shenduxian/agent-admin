'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  checkRuntime,
  checkAllRuntimes,
  requiredRuntimesFor,
  credentialStatus,
} = require('../src/deps');

test('checkRuntime finds node and reports a version', () => {
  const r = checkRuntime('node');
  assert.equal(r.id, 'node');
  assert.equal(r.ok, true);
  assert.ok(r.binPath);
  assert.match(r.version, /\d+\.\d+\.\d+/);
});

test('checkRuntime for an unknown runtime reports not ok', () => {
  const r = checkRuntime('not-a-runtime');
  assert.equal(r.ok, false);
});

test('checkAllRuntimes covers node, python, git', () => {
  const ids = checkAllRuntimes().map((r) => r.id).sort();
  assert.deepEqual(ids, ['git', 'node', 'python']);
});

test('requiredRuntimesFor maps an agent to its runtime checks', () => {
  const rs = requiredRuntimesFor({ runtimes: ['node'] });
  assert.equal(rs.length, 1);
  assert.equal(rs[0].id, 'node');
  assert.equal(requiredRuntimesFor({ runtimes: [] }).length, 0);
  assert.equal(requiredRuntimesFor({}).length, 0);
});

test('credentialStatus reflects process.env', () => {
  const name = 'AGENT_ADMIN_TEST_KEY_XYZ';
  delete process.env[name];
  let status = credentialStatus({ credsEnv: [name] });
  assert.deepEqual(status, [{ name, set: false }]);

  process.env[name] = 'secret';
  try {
    status = credentialStatus({ credsEnv: [name] });
    assert.deepEqual(status, [{ name, set: true }]);
  } finally {
    delete process.env[name];
  }
});
