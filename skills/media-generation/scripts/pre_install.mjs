#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createMessageRequest } from './notification-utils.js';

const SKILL_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODELMAX_DIR = path.join(os.homedir(), '.modelmax');
const MCPORTER_CONFIG_PATH = path.join(MODELMAX_DIR, 'mcporter.json');
const BUNDLE = path.join(SKILL_DIR, 'scripts', 'index.bundle.mjs');
const LOG_PATH = path.join(SKILL_DIR, 'error.log');

function parseNotifyDestination(argv) {
  let channel = '';
  let targetId = '';
  let targetType = '';
  let locale = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      continue;
    }
    if (arg === '--channel') {
      channel = value.trim().toLowerCase();
      i++;
      continue;
    }
    if (arg === '--target-id') {
      targetId = value.trim();
      i++;
      continue;
    }
    if (arg === '--target-type') {
      targetType = value.trim();
      i++;
      continue;
    }
    if (arg === '--locale') {
      locale = value.trim();
      i++;
      continue;
    }
  }

  if (!channel && !targetId && !targetType) {
    return { channel: null, target: null, ...(locale ? { locale } : {}) };
  }
  if (!channel || !targetId || !targetType) {
    throw new Error('--channel, --target-id, and --target-type must be provided together.');
  }
  return {
    channel,
    target: {
      type: targetType,
      id: targetId,
    },
    ...(locale ? { locale } : {}),
  };
}

async function logInstallError(message) {
  try {
    await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
    await fs.appendFile(LOG_PATH, `[${new Date().toISOString()}] [pre-install] ${message}\n`, 'utf8');
  } catch {}
}

function buildInstallNotification(notifyDestination) {
  const messageRequest = createMessageRequest({ messageKey: 'install.success' });
  if (!notifyDestination.channel) {
    return messageRequest;
  }
  return {
    channel: notifyDestination.channel,
    target: {
      ...notifyDestination.target,
      ...(notifyDestination.locale ? { locale: notifyDestination.locale } : {}),
    },
    ...messageRequest,
  };
}

function logCapturedOutput(label, value) {
  const text = Buffer.isBuffer(value) ? value.toString('utf8') : String(value || '');
  if (text.trim()) {
    console.error(`${label}:\n${text.trim()}`);
  }
}

let notifyDestination;
try {
  notifyDestination = parseNotifyDestination(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}

console.error('Step 1: Registering MCP server...');
try {
  await fs.mkdir(path.dirname(MCPORTER_CONFIG_PATH), { recursive: true });
  const output = execFileSync(
    'npx',
    [
      'mcporter',
      '--config',
      MCPORTER_CONFIG_PATH,
      'config',
      'add',
      'modelmax-media',
      `node ${BUNDLE}`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  logCapturedOutput('mcporter', output);
  console.error('  Registered via npx mcporter');
} catch (error) {
  logCapturedOutput('mcporter stdout', error.stdout);
  logCapturedOutput('mcporter stderr', error.stderr);
  console.error('  MCP registration failed:', error.message);
  await logInstallError(`mcporter config add failed: ${error.message}`);
  process.exit(1);
}

console.error('Step 2: Returning install notification payload...');
process.stdout.write(`${JSON.stringify({
  status: 'success',
  notification: buildInstallNotification(notifyDestination),
}, null, 2)}\n`);
console.error('Pre-install complete.');
