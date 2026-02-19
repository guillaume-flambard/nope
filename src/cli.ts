#!/usr/bin/env node
// ═══════════════════════════════════════
// NOPE. — CLI Entry Point
// ═══════════════════════════════════════

import { config } from 'dotenv';
config();

const chalk = require('chalk');
const ora = require('ora');

const VERSION = '0.1.0';

const BANNER = `
  ${chalk.hex('#B5FF4A').bold('NOPE')}${chalk.hex('#71717A')('.')}  ${chalk.dim(`v${VERSION}`)}
  ${chalk.dim('AI that calls companies so you don\'t have to.')}
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log(VERSION);
    return;
  }

  switch (command) {
    case 'call':
      await handleCall(args.slice(1));
      break;
    case 'server':
      await handleServer();
      break;
    case 'companies':
      await handleCompanies();
      break;
    case 'history':
      await handleHistory();
      break;
    default:
      // Treat the entire args as a goal
      await handleCall(args);
  }
}

async function handleCall(args: string[]) {
  console.log(BANNER);

  const goal = args.filter(a => !a.startsWith('--')).join(' ');
  const simulate = args.includes('--simulate') || args.includes('-s') || process.env.SIMULATE === 'true';

  if (!goal) {
    console.log(chalk.hex('#FF4A6E')('  Error: No goal provided.\n'));
    console.log(chalk.dim('  Usage: nope call "Cancel my Netflix subscription"'));
    console.log(chalk.dim('         nope "Résilie mon abonnement Canal+"'));
    console.log(chalk.dim('         nope call --simulate "Negotiate my Comcast bill"\n'));
    return;
  }

  if (simulate) {
    console.log(chalk.dim('  Mode: Simulation (no real call)\n'));
  }

  const { NopeAgent } = await import('./core/agent');
  const agent = new NopeAgent();

  let currentStatus = '';
  const spinner = ora({ text: 'Preparing...', color: 'green', prefixText: '  ' }).start();

  agent.on((event) => {
    switch (event.type) {
      case 'status':
        currentStatus = event.data.status;
        const statusLabels: Record<string, string> = {
          preparing: chalk.dim('Preparing...'),
          dialing: chalk.hex('#4AF0FF')('📞 Dialing...'),
          ivr: chalk.hex('#FBBF24')('🤖 Navigating phone menu...'),
          holding: chalk.hex('#FBBF24')('⏳ On hold...'),
          talking: chalk.hex('#B5FF4A')('💬 Talking to agent...'),
          negotiating: chalk.hex('#FF4A6E')('🔥 Negotiating...'),
          success: chalk.hex('#B5FF4A')('✓ Success!'),
          failed: chalk.hex('#FF4A6E')('✗ Failed'),
        };
        spinner.text = statusLabels[currentStatus] || currentStatus;
        if (currentStatus === 'success' || currentStatus === 'failed') {
          if (currentStatus === 'success') spinner.succeed(statusLabels[currentStatus]);
          else spinner.fail(statusLabels[currentStatus]);
        }
        break;

      case 'transcript':
        const { speaker, text, action } = event.data;
        if (currentStatus === 'success' || currentStatus === 'failed') break;

        spinner.stop();

        const colors: Record<string, string> = {
          nope: '#B5FF4A', agent: '#FF4A6E', ivr: '#FBBF24', system: '#4AF0FF',
        };
        const color = colors[speaker] || '#A1A1AA';
        const label = chalk.hex(color).bold(`  ${speaker.toUpperCase().padEnd(7)}`);

        console.log(`${label} ${chalk.dim(text)}`);
        if (action) {
          console.log(`          ${chalk.bgHex('#1E1E23').hex('#71717A')(` ${action} `)}`);
        }

        spinner.start();
        break;
    }
  });

  try {
    const result = await agent.execute(goal, { simulate });

    console.log('');
    console.log(chalk.hex('#27272A')('  ─────────────────────────────────────'));
    console.log('');

    if (result.status === 'success') {
      console.log(`  ${chalk.hex('#B5FF4A').bold('✓')} ${chalk.bold('Done.')}`);
    } else {
      console.log(`  ${chalk.hex('#FF4A6E').bold('✗')} ${chalk.bold('Could not complete.')}`);
    }

    console.log(`  ${chalk.dim(result.summary)}`);
    console.log('');

    const mins = Math.floor(result.duration / 60);
    const secs = result.duration % 60;
    console.log(`  ${chalk.dim('Duration:')} ${mins}m ${secs}s`);
    console.log(`  ${chalk.dim('Cost:')}     $${result.cost.total.toFixed(3)}`);
    if (result.savings) {
      console.log(`  ${chalk.dim('Savings:')}  ${chalk.hex('#B5FF4A').bold(result.savings + '%')}`);
    }
    console.log('');

  } catch (err: any) {
    spinner.fail(chalk.hex('#FF4A6E')(err.message));
  }
}

async function handleServer() {
  console.log(BANNER);
  const { startServer } = await import('./web/server');
  startServer();
}

async function handleCompanies() {
  console.log(BANNER);
  const { CompanyFinder } = await import('./lookup/company-finder');
  const finder = new CompanyFinder();
  const companies = finder.list();

  console.log(chalk.dim(`  ${companies.length} companies in directory:\n`));

  const categories = [...new Set(companies.map(c => c.category))].sort();
  for (const cat of categories) {
    console.log(`  ${chalk.hex('#B5FF4A').bold(cat.toUpperCase())}`);
    const items = companies.filter(c => c.category === cat);
    for (const item of items) {
      console.log(`    ${chalk.white(item.name.padEnd(20))} ${chalk.dim(item.phone.padEnd(18))} ${chalk.hex('#4AF0FF')(item.country)}`);
    }
    console.log('');
  }
}

async function handleHistory() {
  console.log(BANNER);
  const { CallRecorder } = await import('./core/recorder');
  const recorder = new CallRecorder();
  const calls = await recorder.list();

  if (calls.length === 0) {
    console.log(chalk.dim('  No calls recorded yet.\n'));
    console.log(chalk.dim('  Run a call first:'));
    console.log(chalk.dim('    nope "Cancel my Netflix" --simulate\n'));
    return;
  }

  console.log(chalk.dim(`  ${calls.length} recorded call${calls.length > 1 ? 's' : ''}:\n`));

  for (const call of calls) {
    const date = new Date(call.date);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const mins = Math.floor(call.duration / 60);
    const secs = call.duration % 60;
    const durationStr = `${mins}m ${secs}s`;

    const statusIcon = call.status === 'success'
      ? chalk.hex('#B5FF4A')('~')
      : call.status === 'partial'
        ? chalk.hex('#FBBF24')('~')
        : chalk.hex('#FF4A6E')('x');

    console.log(`  ${statusIcon} ${chalk.white(call.company.padEnd(20))} ${chalk.dim(dateStr)} ${chalk.dim(timeStr)}  ${chalk.dim(durationStr)}`);
    console.log(`    ${chalk.dim(call.goal)}`);
    console.log('');
  }
}

function printHelp() {
  console.log(BANNER);
  console.log(`
  ${chalk.bold('Usage:')}
    ${chalk.hex('#B5FF4A')('nope')} ${chalk.dim('<goal>')}                     Say what you want done
    ${chalk.hex('#B5FF4A')('nope')} call ${chalk.dim('"Cancel my Netflix"')}    Start a call
    ${chalk.hex('#B5FF4A')('nope')} history                       Show past calls
    ${chalk.hex('#B5FF4A')('nope')} server                        Start web dashboard
    ${chalk.hex('#B5FF4A')('nope')} companies                     List known companies

  ${chalk.bold('Options:')}
    --simulate, -s     Run in simulation mode (no real call)
    --version, -v      Show version
    --help, -h         Show this help

  ${chalk.bold('Examples:')}
    ${chalk.dim('$')} nope "Cancel my Netflix subscription"
    ${chalk.dim('$')} nope "Résilie mon abonnement Canal+"
    ${chalk.dim('$')} nope "Negotiate my Comcast bill" --simulate
    ${chalk.dim('$')} nope server

  ${chalk.dim('Docs: https://github.com/nope-ai/nope')}
`);
}

main().catch(err => {
  console.error(chalk.hex('#FF4A6E')(`\n  Error: ${err.message}\n`));
  process.exit(1);
});
