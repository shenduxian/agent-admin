'use strict';

const { RUNTIMES, AGENTS } = require('./registry');
const { which, tryVersion } = require('./utils');

function checkRuntime(key) {
  const spec = RUNTIMES[key];
  if (!spec) return { id: key, ok: false, reason: 'unknown runtime' };
  const p = which(spec.bin);
  if (!p) return { id: key, ok: false, binPath: null, install: spec.install };
  return {
    id: key,
    ok: true,
    binPath: p,
    version: tryVersion(spec.bin, spec.versionArgs),
  };
}

function checkAllRuntimes() {
  return Object.keys(RUNTIMES).map(checkRuntime);
}

function requiredRuntimesFor(agent) {
  return (agent.runtimes || []).map(checkRuntime);
}

function credentialStatus(agent) {
  const envs = agent.credsEnv || [];
  return envs.map((name) => ({
    name,
    set: Boolean(process.env[name]),
  }));
}

function summarize(agents = AGENTS) {
  return agents.map((a) => ({
    id: a.id,
    runtimes: requiredRuntimesFor(a),
    credentials: credentialStatus(a),
  }));
}

module.exports = {
  checkRuntime,
  checkAllRuntimes,
  requiredRuntimesFor,
  credentialStatus,
  summarize,
};
