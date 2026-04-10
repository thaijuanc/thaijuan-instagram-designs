#!/usr/bin/env node

/**
 * ThaiJuan Instagram Notification Checker
 * 
 * Checks for pending notifications from auto-poster.
 * Sends notification to user when posts are published.
 * Clears notification after sending.
 */

const fs = require('fs');
const path = require('path');

const NOTIFICATION_PATH = path.join(__dirname, 'notification-pending.json');

function checkNotifications() {
  // Check if notification file exists
  if (!fs.existsSync(NOTIFICATION_PATH)) {
    console.log('⏳ No pending notifications.');
    return;
  }

  // Read notification
  let notification;
  try {
    notification = JSON.parse(fs.readFileSync(NOTIFICATION_PATH, 'utf8'));
  } catch (error) {
    console.error('❌ Error reading notification file:', error.message);
    return;
  }

  // Log notification details
  console.log('📬 Notification found:');
  console.log(`   Type: ${notification.type}`);
  console.log(`   Headline: ${notification.headline}`);
  console.log(`   Promotion: ${notification.promotion}`);
  console.log(`   Post ID: ${notification.postId}`);
  console.log(`   Scheduled: ${notification.scheduledTime}`);
  console.log(`   Message: ${notification.message}`);

  // Clear notification file after reading
  try {
    fs.unlinkSync(NOTIFICATION_PATH);
    console.log('✅ Notification cleared from pending file.');
  } catch (error) {
    console.error('⚠️  Warning: Could not clear notification file:', error.message);
  }

  // Output for parent process to capture and send
  console.log('\n--- NOTIFICATION READY TO SEND ---');
  console.log(JSON.stringify({
    type: 'instagram_post_published',
    headline: notification.headline,
    promotion: notification.promotion,
    postId: notification.postId,
    instagramUrl: `https://www.instagram.com/p/${notification.postId}`,
    scheduledTime: notification.scheduledTime,
    message: notification.message
  }, null, 2));
}

checkNotifications();
