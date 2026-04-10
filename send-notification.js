#!/usr/bin/env node

/**
 * ThaiJuan Notification Sender
 * 
 * Checks for posts that went live in the last 5 minutes
 * and writes notification to discord-notification-pending.json
 * 
 * Run every minute via cron.
 */

const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, 'campaign-state.json');
const SCHEDULE_PATH = path.join(__dirname, 'campaign-schedule.json');
const DISCORD_PENDING_PATH = path.join(__dirname, 'discord-notification-pending.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function checkAndNotify() {
  try {
    const state = loadJson(STATE_PATH);
    const schedule = loadJson(SCHEDULE_PATH);
    
    // Get the most recent post
    const lastPostId = state.lastPostId;
    const lastPostDate = state.lastPostDate;
    
    if (!lastPostId) {
      console.log('⏳ No posts yet');
      process.exit(0);
    }
    
    // Find the post in schedule
    const post = schedule.posts.find(p => p.postId === lastPostId);
    
    if (!post) {
      console.log('⏳ Post not found in schedule');
      process.exit(0);
    }
    
    // Check if already notified
    if (post.notificationSent) {
      console.log(`✅ Already notified: ${post.headline}`);
      process.exit(0);
    }
    
    // Write notification for main agent to send
    const notification = {
      headline: post.headline,
      promotion: post.promotion,
      instagramUrl: `https://www.instagram.com/p/${lastPostId}/`,
      postedTime: post.scheduledTime,
      message: `✅ **Post Published!**\n\n📌 **${post.headline}**\n🎯 ${post.promotion}\n🔗 https://www.instagram.com/p/${lastPostId}/\n\nPosted at ${post.scheduledTime}\n\nGet it at ThaiJuan, Surry Hills!`
    };
    
    saveJson(DISCORD_PENDING_PATH, notification);
    console.log(`📬 Notification ready: ${post.headline}`);
    
    // Mark as sent
    post.notificationSent = true;
    fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2) + '\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAndNotify();
