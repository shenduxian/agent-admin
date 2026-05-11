'use strict';

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function which(bin) {
  try {
    const out = execFileSync('/usr/bin/which', [bin], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const p = out.trim();
    return p || null;
  } catch {
    return null;
  }
}

// Every match for `bin` on PATH, in priority order, de-duplicated. Lets us
// surface the "I have three copies of node and the wrong one wins" situation.
function whichAll(bin) {
  try {
    const out = execFileSync('/usr/bin/which', ['-a', bin], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
    return [...new Set(lines)];
  } catch {
    return [];
  }
}

function tryVersion(bin, args = ['--version'], timeoutMs = 4000) {
  try {
    const out = execFileSync(bin, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return firstLine(out);
  } catch (err) {
    if (err && err.stdout) return firstLine(err.stdout.toString());
    return null;
  }
}

function firstLine(s) {
  const line = String(s || '').split('\n').map((x) => x.trim()).find(Boolean);
  return line || null;
}

function pathExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function readTextSafe(p, maxBytes = 64 * 1024) {
  try {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) return null;
    const fd = fs.openSync(p, 'r');
    const buf = Buffer.alloc(Math.min(stat.size, maxBytes));
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

function ensureMacOS() {
  if (process.platform !== 'darwin') {
    process.stderr.write(`warning: this tool targets macOS; current platform is ${process.platform}\n`);
  }
}

module.exports = {
  which,
  whichAll,
  tryVersion,
  pathExists,
  readJsonSafe,
  readTextSafe,
  ensureMacOS,
};
