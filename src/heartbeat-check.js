#!/usr/bin/env node

/**
 * Heartbeat Notification Checker — WITH USER MESSAGES
 * 
 * Checks for pending notifications and sends message to Juan.
 * Run this every 2 minutes via cron.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const NOTIFICATION_PATH = path.join(__dirname, 'notification-pending.json');
const MESSAGE_PENDING_PATH = path.join(__dirname, 'message-pending.json');
const LOG_PATH = '/tmp/thaijuan-heartbeat.log';

function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(LOG_PATH, logEntry);
}

function checkAndSendNotifications() {
  // Check for pending notification file
  if (!fs.existsSync(NOTIFICATION_PATH)) {
    log('⏳ No pending notifications.');
    return;
  }
  
  try {
    const notification = JSON.parse(fs.readFileSync(NOTIFICATION_PATH, 'utf8'));
    
    // Clear the notification file after reading
    fs.unlinkSync(NOTIFICATION_PATH);
    
    log(`📬 Notification found: ${notification.headline}`);
    
    // Format message for Juan
    const messageForJuan = {
      type: 'instagram_post_published',
      timestamp: new Date().toISOString(),
      headline: notification.headline,
      promotion: notification.promotion,
      postId: notification.postId,
      instagramUrl: notification.instagramUrl || `https://www.instagram.com/p/${notification.postId}`,
      scheduledTime: notification.scheduledTime,
      message: `✅ **Post Published!**

📌 **${notification.headline}**
🎯 ${notification.promotion}
🔗 ${notification.instagramUrl || `https://www.instagram.com/p/${notification.postId}`}

Posted at ${new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Melbourne' })}`
    };
    
    // Write message to pending file (for assistant to send)
    fs.writeFileSync(
      MESSAGE_PENDING_PATH,
      JSON.stringify(messageForJuan, null, 2) + '\n'
    );
    
    log(`✉️ Message written to ${MESSAGE_PENDING_PATH}`);
    log(`✅ Notification processed: ${notification.headline}`);
    
  } catch (e) {
    log(`❌ Error processing notification: ${e.message}`);
    console.error(e);
  }
}

// Run check
checkAndSendNotifications();
