#!/usr/bin/env node

/**
 * ThaiJuan Message Sender
 * 
 * Checks for pending messages and sends them to Juan.
 * Runs every minute via cron.
 * 
 * This bridges the gap between:
 * - Heartbeat (writes message-pending.json)
 * - Juan (receives Discord/message notification)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MESSAGE_PENDING_PATH = path.join(__dirname, 'message-pending.json');
const MESSAGE_SENT_PATH = path.join(__dirname, 'message-sent.json');
const LOG_PATH = '/tmp/thaijuan-messages.log';

function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(LOG_PATH, logEntry);
}

function checkAndSendMessages() {
  // Check for pending message file
  if (!fs.existsSync(MESSAGE_PENDING_PATH)) {
    log('⏳ No pending messages.');
    return;
  }
  
  try {
    const message = JSON.parse(fs.readFileSync(MESSAGE_PENDING_PATH, 'utf8'));
    
    log(`📬 Found pending message: ${message.headline}`);
    
    // Format the message for Juan
    const messageText = `${message.message}`;
    
    // Write to a file that the assistant can read and send
    // This is the bridge between cron and the assistant
    const discordMessage = {
      channel: 'discord',
      to: 'channel:1492002779021971457', // Juan's Discord channel
      message: messageText,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'discord-message-pending.json'),
      JSON.stringify(discordMessage, null, 2) + '\n'
    );
    
    log(`✉️ Discord message written to discord-message-pending.json`);
    
    // Move to sent folder (archive)
    fs.renameSync(MESSAGE_PENDING_PATH, MESSAGE_SENT_PATH.replace('.json', `-${Date.now()}.json`));
    
    log(`✅ Message sent and archived!`);
    
  } catch (e) {
    log(`❌ Error processing message: ${e.message}`);
    console.error(e);
  }
}

// Run check
checkAndSendMessages();
