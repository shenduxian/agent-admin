'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const pkg = require('../package.json');

const { AGENTS, findAgent } = require('./registry');
const { detectAgent, detectAll } = require('./detect');
const {
  checkAllRuntimes,
  checkRuntime,
  requiredRuntimesFor,
} = require('./deps');
const {
  listConfigsFor,
  extractMcpServers,
  listAllMcp,
  credsEnvStatus,
  credsFilesStatus,
} = require('./config');
const { ensureMacOS } = require('./utils');

function run(argv) {
  ensureMacOS();
  const program = new Command();

  program
    .name('agent-admin')
    .description('Manage locally installed AI coding agents (Claude Code, Cursor, Codex, Gemini, Aider, …) and their dependencies.')
    .version(pkg.version, '-v, --version');

  registerList(program);
  registerInfo(program);
  registerDoctor(program);
  registerConfig(program);
  registerMcp(program);
  registerCreds(program);
  registerRegistry(program);

  program.parseAsync(argv).catch((err) => {
    process.stderr.write(chalk.red(`error: ${err.message || err}\n`));
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

function registerList(program) {
  program
    .command('list')
    .alias('ls')
    .description('List known agents and which ones are installed on this machine')
    .option('--installed', 'show only agents detected as installed')
    .option('--json', 'machine-readable output')
    .action((opts) => {
      const all = detectAll();
      const rows = opts.installed ? all.filter((a) => a.installed) : all;
      if (opts.json) {
        process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
        return;
      }
      printAgentTable(rows);
    });
}

function registerInfo(program) {
  program
    .command('info <agent>')
    .description('Show detailed status for a single agent')
    .option('--json', 'machine-readable output')
    .action((id, opts) => {
      const agent = findAgent(id);
      if (!agent) return fail(`unknown agent: ${id}. Try \`agent-admin registry\`.`);
      const status = detectAgent(agent);
      const detail = {
        ...status,
        configPaths: listConfigsFor(agent),
        runtimes: requiredRuntimesFor(agent),
        mcpServers: extractMcpServers(agent),
        credentials: {
          env: credsEnvStatus(agent),
          files: credsFilesStatus(agent),
        },
        docs: agent.docs,
      };
      if (opts.json) {
        process.stdout.write(JSON.stringify(detail, null, 2) + '\n');
        return;
      }
      printAgentDetail(agent, detail);
    });
}

function registerDoctor(program) {
  program
    .command('doctor')
    .description('Check runtime dependencies and credentials for installed agents')
    .option('-a, --all', 'check every known agent, not only installed ones')
    .option('--json', 'machine-readable output')
    .action((opts) => {
      const runtimes = checkAllRuntimes();
      const detections = detectAll();
      const target = opts.all ? detections : detections.filter((d) => d.installed);

      const report = {
        runtimes,
        agents: target.map((d) => {
          const agent = findAgent(d.id);
          return {
            id: d.id,
            name: d.name,
            installed: d.installed,
            partial: Boolean(d.partial),
            version: d.version,
            runtimes: requiredRuntimesFor(agent),
            credentials: credsEnvStatus(agent),
          };
        }),
      };

      if (opts.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        return;
      }
      printDoctorReport(report);
    });
}

function registerConfig(program) {
  const cmd = program.command('config').description('Inspect agent configuration files');

  cmd
    .command('show <agent>')
    .description('Show the config file/dir paths an agent uses and whether they exist')
    .action((id) => {
      const agent = findAgent(id);
      if (!agent) return fail(`unknown agent: ${id}`);
      const rows = listConfigsFor(agent);
      if (!rows.length) {
        console.log(chalk.dim('no known config paths for this agent'));
        return;
      }
      for (const r of rows) {
        const tag = r.exists ? chalk.green(r.isDir ? 'dir ' : 'file') : chalk.dim('miss');
        console.log(`  ${tag}  ${r.path}`);
      }
    });

  cmd
    .command('paths')
    .description('Dump every known config path across all agents (useful for backup scripts)')
    .option('--existing', 'only paths that currently exist')
    .action((opts) => {
      for (const agent of AGENTS) {
        for (const row of listConfigsFor(agent)) {
          if (opts.existing && !row.exists) continue;
          console.log(`${agent.id}\t${row.exists ? '+' : '-'}\t${row.path}`);
        }
      }
    });
}

function registerMcp(program) {
  const cmd = program.command('mcp').description('Inspect MCP servers configured across agents');

  cmd
    .command('list')
    .description('List MCP servers configured in any known agent')
    .option('--json', 'machine-readable output')
    .action((opts) => {
      const groups = listAllMcp();
      if (opts.json) {
        process.stdout.write(JSON.stringify(groups, null, 2) + '\n');
        return;
      }
      if (!groups.length) {
        console.log(chalk.dim('no MCP servers found in any known agent config'));
        return;
      }
      for (const g of groups) {
        console.log(chalk.bold(g.agent));
        for (const s of g.servers) {
          const k = chalk.dim(`(${s.kind})`);
          const tail = s.command ? `  ${chalk.dim(s.command)}` : s.endpoint ? `  ${chalk.dim(s.endpoint)}` : '';
          console.log(`  ${s.name} ${k}${tail}`);
          console.log(`    ${chalk.dim(s.source)}`);
        }
      }
    });

  cmd
    .command('show <agent>')
    .description('Show MCP servers configured for a single agent')
    .action((id) => {
      const agent = findAgent(id);
      if (!agent) return fail(`unknown agent: ${id}`);
      const servers = extractMcpServers(agent);
      if (!servers.length) {
        console.log(chalk.dim(`no MCP servers configured for ${agent.id}`));
        return;
      }
      for (const s of servers) {
        const tail = s.command || s.endpoint || '';
        console.log(`  ${s.name}  ${chalk.dim(`[${s.kind}] ${tail}`)}`);
        console.log(`    ${chalk.dim(s.source)}`);
      }
    });
}

function registerCreds(program) {
  const cmd = program.command('creds').description('Inspect credentials / API keys used by agents');

  cmd
    .command('status')
    .description('Show which credential env vars are set (values are masked)')
    .option('-a, --all', 'include agents that are not installed')
    .action((opts) => {
      const detections = detectAll();
      const target = opts.all ? AGENTS : AGENTS.filter((a) => detections.find((d) => d.id === a.id && d.installed));
      for (const agent of target) {
        const env = credsEnvStatus(agent);
        const files = credsFilesStatus(agent);
        if (!env.length && !files.length) continue;
        console.log(chalk.bold(`${agent.id}`));
        for (const e of env) {
          const mark = e.set ? chalk.green('set ') : chalk.red('miss');
          console.log(`  env  ${mark}  ${e.name}${e.preview ? '  ' + chalk.dim(e.preview) : ''}`);
        }
        for (const f of files) {
          const mark = f.exists ? chalk.green('exists') : chalk.dim('absent');
          console.log(`  file ${mark}  ${f.path}`);
        }
      }
    });
}

function registerRegistry(program) {
  program
    .command('registry')
    .description('List every agent id this tool knows about')
    .option('--json', 'machine-readable output')
    .action((opts) => {
      if (opts.json) {
        process.stdout.write(JSON.stringify(AGENTS.map(strip), null, 2) + '\n');
        return;
      }
      for (const a of AGENTS) {
        console.log(`  ${a.id.padEnd(14)} ${chalk.dim(`(${a.kind})`)}  ${a.name}`);
      }
    });
}

function strip(a) {
  // omit functions if any are ever added; here it is just data, but be defensive.
  const { id, name, kind, bins, runtimes, installHint, docs } = a;
  return { id, name, kind, bins, runtimes, installHint, docs };
}

// ---------------------------------------------------------------------------
// printers
// ---------------------------------------------------------------------------

function printAgentTable(rows) {
  if (!rows.length) {
    console.log(chalk.dim('no agents to show'));
    return;
  }
  const header = ['', 'AGENT', 'VERSION', 'PATH'];
  const data = rows.map((r) => [
    r.installed ? (r.partial ? chalk.yellow('~') : chalk.green('✓')) : chalk.dim('·'),
    r.id,
    r.version || (r.installed ? chalk.dim('-') : ''),
    r.binPath || r.appPath || (r.configPresent[0] ? chalk.dim(r.configPresent[0]) : ''),
  ]);
  printTable(header, data);
}

function printAgentDetail(agent, d) {
  const tag = d.installed ? (d.partial ? chalk.yellow('partial') : chalk.green('installed')) : chalk.red('not installed');
  console.log(`${chalk.bold(agent.name)}  ${chalk.dim(`(${agent.id})`)}  ${tag}`);
  if (d.version) console.log(`  version    ${d.version}`);
  if (d.binPath) console.log(`  binary     ${d.binPath}`);
  if (d.appPath) console.log(`  app        ${d.appPath}`);
  if (agent.docs) console.log(`  docs       ${chalk.dim(agent.docs)}`);
  if (!d.installed && agent.installHint) {
    console.log(`  ${chalk.yellow('hint')}       ${agent.installHint}`);
  }

  if (d.configPaths.length) {
    console.log(chalk.bold('\nconfig'));
    for (const c of d.configPaths) {
      const mark = c.exists ? chalk.green(c.isDir ? 'dir ' : 'file') : chalk.dim('miss');
      console.log(`  ${mark}  ${c.path}`);
    }
  }

  if (d.runtimes.length) {
    console.log(chalk.bold('\nruntime dependencies'));
    for (const r of d.runtimes) {
      const mark = r.ok ? chalk.green('ok  ') : chalk.red('miss');
      const ver = r.version ? `  ${chalk.dim(r.version)}` : '';
      const hint = r.ok ? '' : `  ${chalk.dim('install: ' + r.install)}`;
      console.log(`  ${mark}  ${r.id}${ver}${hint}`);
    }
  }

  if (d.mcpServers.length) {
    console.log(chalk.bold('\nMCP servers'));
    for (const s of d.mcpServers) {
      const tail = s.command || s.endpoint || '';
      console.log(`  ${s.name}  ${chalk.dim(`[${s.kind}] ${tail}`)}`);
    }
  }

  if (d.credentials.env.length) {
    console.log(chalk.bold('\ncredentials'));
    for (const e of d.credentials.env) {
      const mark = e.set ? chalk.green('set ') : chalk.red('miss');
      console.log(`  env  ${mark}  ${e.name}${e.preview ? '  ' + chalk.dim(e.preview) : ''}`);
    }
    for (const f of d.credentials.files) {
      const mark = f.exists ? chalk.green('exists') : chalk.dim('absent');
      console.log(`  file ${mark}  ${f.path}`);
    }
  }
}

function printDoctorReport(report) {
  console.log(chalk.bold('runtimes'));
  for (const r of report.runtimes) {
    const mark = r.ok ? chalk.green('ok  ') : chalk.red('miss');
    const ver = r.version ? `  ${chalk.dim(r.version)}` : '';
    const hint = r.ok ? '' : `  ${chalk.dim('install: ' + r.install)}`;
    console.log(`  ${mark}  ${r.id}${ver}${hint}`);
  }

  console.log(chalk.bold('\nagents'));
  for (const a of report.agents) {
    const tag = a.installed ? (a.partial ? chalk.yellow('~') : chalk.green('✓')) : chalk.dim('·');
    console.log(`  ${tag}  ${a.id}${a.version ? '  ' + chalk.dim(a.version) : ''}`);
    for (const r of a.runtimes) {
      const mark = r.ok ? chalk.green('  ok  ') : chalk.red('  miss');
      console.log(`    ${mark}  runtime: ${r.id}${r.version ? '  ' + chalk.dim(r.version) : ''}`);
    }
    for (const c of a.credentials) {
      const mark = c.set ? chalk.green('  ok  ') : chalk.yellow('  warn');
      console.log(`    ${mark}  env: ${c.name}${c.set ? '' : chalk.dim(' (unset)')}`);
    }
  }
}

function printTable(header, rows) {
  const widths = header.map((h, i) =>
    Math.max(stripAnsi(h).length, ...rows.map((r) => stripAnsi(String(r[i] || '')).length)),
  );
  const fmt = (cells) =>
    cells
      .map((c, i) => {
        const s = String(c || '');
        const pad = widths[i] - stripAnsi(s).length;
        return s + ' '.repeat(Math.max(0, pad));
      })
      .join('  ');
  console.log(chalk.dim(fmt(header)));
  for (const r of rows) console.log(fmt(r));
}

function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

function fail(msg) {
  process.stderr.write(chalk.red(`error: ${msg}\n`));
  process.exit(2);
}

module.exports = { run };
