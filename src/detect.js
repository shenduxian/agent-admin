'use strict';

const { AGENTS } = require('./registry');
const { which, tryVersion, pathExists } = require('./utils');

/**
 * Probe a single agent and return a status object.
 *
 * The detection cascade is deliberately permissive — an agent counts as
 * "installed" if we can find a binary OR a desktop bundle OR a config dir,
 * which lets us surface partial installs (e.g. config left behind after an
 * uninstall) instead of pretending nothing is there.
 */
function detectAgent(agent) {
  const status = {
    id: agent.id,
    name: agent.name,
    kind: agent.kind,
    installed: false,
    binPath: null,
    version: null,
    appPath: null,
    configPresent: [],
    runtimes: agent.runtimes || [],
    installHint: agent.installHint,
  };

  for (const bin of agent.bins || []) {
    const p = which(bin);
    if (p) {
      status.binPath = p;
      status.installed = true;
      const v = tryVersion(bin, agent.versionArgs || ['--version']);
      if (v) status.version = v;
      break;
    }
  }

  for (const app of agent.appPaths || []) {
    if (pathExists(app)) {
      status.appPath = app;
      status.installed = true;
      break;
    }
  }

  for (const cfg of agent.configPaths || []) {
    if (pathExists(cfg)) {
      status.configPresent.push(cfg);
    }
  }

  if (!status.installed && status.configPresent.length > 0) {
    status.installed = true;
    status.partial = true;
  }

  return status;
}

function detectAll() {
  return AGENTS.map(detectAgent);
}

module.exports = { detectAgent, detectAll };
