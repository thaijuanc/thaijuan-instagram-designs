#!/usr/bin/env node

/**
 * Daily AI Digest → Discord Sender
 *
 * Reads today's digest from memory/digests/YYYY-MM-DD.md and sends it
 * to Discord via webhook. Runs daily at 8 AM via cron.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

// Load environment variables from .env (same pattern as notify-juan.js)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) return;
    const key = line.substring(0, eqIndex).trim();
    const value = line.substring(eqIndex + 1).trim();
    if (key && value) process.env[key] = value;
  });
}

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!DISCORD_WEBHOOK_URL) {
  console.error('DISCORD_WEBHOOK_URL not set. Check .env file at:', envPath);
  process.exit(1);
}

// Construct today's digest file path
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const DIGEST_FILENAME = `${year}-${month}-${day}.md`;
const DIGEST_FILE_PATH = path.join(__dirname, '../memory/digests', DIGEST_FILENAME);

if (!fs.existsSync(DIGEST_FILE_PATH)) {
  console.error(`Digest file not found: ${DIGEST_FILE_PATH}`);
  process.exit(1);
}

const digestContent = fs.readFileSync(DIGEST_FILE_PATH, 'utf8');

// Truncate if needed (Discord max message is 2000 chars)
const maxLen = 1900;
let message = `**☀️ Daily AI Digest — ${year}-${month}-${day}**\n\n${digestContent}`;
if (message.length > maxLen) {
  message = message.substring(0, maxLen) + '\n\n…_(truncated)_';
}

// Send via Discord webhook using native https (no curl dependency)
const payload = JSON.stringify({ content: message });
const parsed = new URL(DISCORD_WEBHOOK_URL);

const options = {
  hostname: parsed.hostname,
  path: parsed.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`AI Digest sent to Discord successfully (${res.statusCode}).`);
    } else {
      console.error(`Discord webhook failed (${res.statusCode}):`, body);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('Error sending AI Digest:', err.message);
  process.exit(1);
});

req.write(payload);
req.end();
