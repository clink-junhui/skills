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
const MESSAGE_SENDER = path.join(SKILL_DIR, 'scripts', 'send-message.mjs');
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
    throw new Error('A notify target is required. Use --channel, --target-id, and --target-type.');
  }
  if (!channel || !targetId || !targetType) {
    throw new Error('--channel, --target-id, and --target-type must be provided together.');
  }
  if (channel === 'feishu' && targetType !== 'chat_id' && targetType !== 'open_id') {
    throw new Error('--target-type must be "chat_id" or "open_id" when --channel feishu is used.');
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

async function sendInstallNotification(notifyDestination) {
  const payload = {
    channel: notifyDestination.channel,
    target: {
      ...notifyDestination.target,
      ...(notifyDestination.locale ? { locale: notifyDestination.locale } : {}),
    },
    deliver: true,
    ...createMessageRequest({ messageKey: 'install.success' }),
  };

  execFileSync(
    process.execPath,
    [MESSAGE_SENDER, '--payload', JSON.stringify(payload)],
    { stdio: 'inherit' },
  );
}

let notifyDestination;
try {
  notifyDestination = parseNotifyDestination(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}

console.log('Step 1: Registering MCP server...');
try {
  await fs.mkdir(path.dirname(MCPORTER_CONFIG_PATH), { recursive: true });
  execFileSync(
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
    { stdio: 'inherit' },
  );
  console.log('  ✅ Registered via npx mcporter');
} catch (error) {
  console.error('  ❌ MCP registration failed:', error.message);
  await logInstallError(`mcporter config add failed: ${error.message}`);
  process.exit(1);
}

console.log('Step 2: Sending install notification...');
try {
  await sendInstallNotification(notifyDestination);
  console.log('  ✅ Install notification sent');
} catch (error) {
  console.error('  ❌ Install notification failed:', error.message);
  await logInstallError(`install notification failed: ${error.message}`);
  process.exit(1);
}

console.log('\nPre-install complete.');
