'use strict';

const { AGENTS } = require('./registry');
const { whichAll, tryVersion, pathExists } = require('./utils');

/**
 * Probe a single agent and return a status object.
 *
 * The detection cascade is deliberately permissive — an agent counts as
 * "installed" if we can find a binary OR a desktop bundle OR a config dir,
 * which lets us surface partial installs (e.g. config left behind after an
 * uninstall) instead of pretending nothing is there.
 *
 * All matches for each candidate binary are collected (not just the first on
 * PATH), so a machine with several copies of the same agent — a brew build, an
 * npm global, an nvm-managed one — is reported as such instead of silently
 * picking whichever shadows the rest.
 */
function detectAgent(agent) {
  const status = {
    id: agent.id,
    name: agent.name,
    kind: agent.kind,
    installed: false,
    binPath: null,
    binPaths: [],
    version: null,
    multipleInstalls: false,
    appPath: null,
    appPaths: [],
    configPresent: [],
    runtimes: agent.runtimes || [],
    installHint: agent.installHint,
  };

  const versionArgs = agent.versionArgs || ['--version'];
  const seen = new Set();
  for (const bin of agent.bins || []) {
    for (const p of whichAll(bin)) {
      if (seen.has(p)) continue;
      seen.add(p);
      status.binPaths.push({ path: p, version: tryVersion(p, versionArgs) });
    }
  }
  if (status.binPaths.length) {
    status.installed = true;
    status.binPath = status.binPaths[0].path;
    status.version = status.binPaths[0].version;
    status.multipleInstalls = status.binPaths.length > 1;
  }

  for (const app of agent.appPaths || []) {
    if (pathExists(app)) {
      status.appPaths.push(app);
      if (!status.appPath) status.appPath = app;
      status.installed = true;
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
