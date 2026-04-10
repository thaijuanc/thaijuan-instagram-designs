#!/usr/bin/env node

/**
 * Heartbeat Notification Checker
 * 
 * Checks for pending notifications and reports them.
 * Run this during every heartbeat.
 */

const fs = require('fs');
const path = require('path');

const NOTIFICATION_PATH = path.join(__dirname, 'notification-pending.json');
const LOG_PATH = '/tmp/thaijuan-notifications.log';

function checkNotifications() {
  // Check for pending notification file
  if (!fs.existsSync(NOTIFICATION_PATH)) {
    return null;
  }
  
  try {
    const notification = JSON.parse(fs.readFileSync(NOTIFICATION_PATH, 'utf8'));
    
    // Clear the file after reading
    fs.unlinkSync(NOTIFICATION_PATH);
    
    // Log it
    const logEntry = `[${new Date().toISOString()}] Notification checked: ${notification.headline}\n`;
    fs.appendFileSync(LOG_PATH, logEntry);
    
    return notification;
  } catch (e) {
    console.error('Error reading notification:', e.message);
    return null;
  }
}

// Run check
const notification = checkNotifications();

if (notification) {
  console.log('=== NOTIFICATION READY ===');
  console.log(`TYPE: ${notification.type}`);
  console.log(`HEADLINE: ${notification.headline}`);
  console.log(`PROMOTION: ${notification.promotion}`);
  console.log(`POST_ID: ${notification.postId}`);
  console.log(`MESSAGE: ${notification.message}`);
  console.log('==========================');
  process.exit(0);
} else {
  console.log('No pending notifications');
  process.exit(0);
}
