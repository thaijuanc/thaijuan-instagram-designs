#!/usr/bin/env node

/**
 * ThaiJuan → Juan Discord Notifier
 * 
 * Checks for pending Instagram post notifications and sends to Juan via Discord webhook.
 * Runs every minute via cron.
 * 
 * Fully automatic - no agent monitoring required.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables from .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.trim();
  });
}

const NOTIFICATION_PATH = path.join(__dirname, 'message-pending.json');
const ARCHIVE_PATH = path.join(__dirname, 'notifications-sent');
const LOG_PATH = '/tmp/thaijuan-notify-juan.log';

// Discord webhook URL - REPLACE WITH YOURS
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'YOUR_WEBHOOK_URL_HERE';

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
  fs.appendFileSync(LOG_PATH, `[${ts}] ${msg}\n`);
}

function sendToWebhook(message, headline) {
  const payload = Buffer.from(JSON.stringify({
    content: message,
    username: 'ThaiJuan Bot'
  }));
  
  const url = new URL(WEBHOOK_URL);
  
  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + '?wait=true',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 204 || res.statusCode === 200) {
        log(`✅ Sent to Discord: ${headline}`);
      } else {
        log(`❌ Discord error: ${res.statusCode} - ${data}`);
      }
    });
  });
  
  req.on('error', (e) => {
    log(`❌ Webhook error: ${e.message}`);
  });
  
  req.write(payload);
  req.end();
}

function run() {
  log('🔍 Checking for pending notifications...');
  if (!fs.existsSync(NOTIFICATION_PATH)) {
    log('⏳ No pending notifications.');
    return;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(NOTIFICATION_PATH, 'utf8'));
    fs.unlinkSync(NOTIFICATION_PATH);
    
    const message = `✅ **Post Published!**

📌 **${data.headline}**
🎯 ${data.promotion}
🔗 ${data.instagramUrl}

Posted at ${new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Melbourne' })}`;
    
    // Send to Discord webhook
    sendToWebhook(message, data.headline);
    
    // Archive
    if (!fs.existsSync(ARCHIVE_PATH)) fs.mkdirSync(ARCHIVE_PATH, { recursive: true });
    fs.writeFileSync(path.join(ARCHIVE_PATH, `notification-${Date.now()}.json`), JSON.stringify(data, null, 2));
    
    log(`✅ Ready: ${data.headline}`);
    
  } catch (e) {
    log(`❌ ${e.message}`);
  }
}

run();
