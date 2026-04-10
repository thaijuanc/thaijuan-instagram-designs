#!/usr/bin/env node

/**
 * Check Pending Messages - Simple Version
 * 
 * Checks message-pending.json and outputs the message.
 * The assistant reads this and sends to Juan.
 * 
 * Run every minute via cron.
 */

const fs = require('fs');
const path = require('path');

const MESSAGE_PENDING_PATH = path.join(__dirname, 'message-pending.json');
const MESSAGE_SENT_PATH = path.join(__dirname, 'messages-sent.jsonl');
const LOG_PATH = '/tmp/thaijuan-pending-check.log';

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(LOG_PATH, `[${timestamp}] ${message}\n`);
}

function checkPending() {
  if (!fs.existsSync(MESSAGE_PENDING_PATH)) {
    log('⏳ No pending messages');
    process.exit(0);
  }
  
  try {
    const message = JSON.parse(fs.readFileSync(MESSAGE_PENDING_PATH, 'utf8'));
    
    log(`📬 Found: ${message.headline}`);
    
    // Output the message in a format the assistant can parse
    console.log('\n=== PENDING MESSAGE FOR JUAN ===');
    console.log(`CHANNEL: discord`);
    console.log(`TO: channel:1492002779021971457`);
    console.log(`MESSAGE: ${message.message}`);
    console.log('=================================\n');
    
    // Archive it
    const archiveEntry = JSON.stringify({
      ...message,
      sentAt: new Date().toISOString()
    }) + '\n';
    
    fs.appendFileSync(MESSAGE_SENT_PATH, archiveEntry);
    fs.unlinkSync(MESSAGE_PENDING_PATH);
    
    log('✅ Message queued for delivery');
    
  } catch (e) {
    log(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

checkPending();
