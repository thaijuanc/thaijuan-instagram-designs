#!/usr/bin/env node

/**
 * ThaiJuan Instagram Poster — SIMPLE VERSION
 * 
 * One script. One job: Post scheduled content.
 * 
 * Features:
 * - Scans ALL posts in schedule (supports multiple posts/day)
 * - Posts at exact scheduled time
 * - Writes notification file for user alert
 * - Logs everything
 * 
 * Runs every minute via cron.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// File paths
const CONFIG_PATH = path.join(__dirname, '../../instagram-automation/config.json');
const SCHEDULE_PATH = path.join(__dirname, 'campaign-schedule.json');
const STATE_PATH = path.join(__dirname, 'campaign-state.json');
const NOTIFICATION_PATH = path.join(__dirname, 'notification-pending.json');
const LOG_PATH = '/tmp/thaijuan-instagram.log';

// Load JSON file
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Save JSON file
function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

// Log with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(LOG_PATH, logEntry);
}

// Make POST request to Graph API
function apiPost(endpoint, params) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': params.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(params);
    req.end();
  });
}

// Post to Instagram
async function postToInstagram(imageUrl, caption, config) {
  const baseUrl = `https://graph.facebook.com/v18.0/${config.instagram.instagramBusinessId}`;

  // Step 1: Create media container
  log(`📤 Creating media container...`);
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption: caption,
    access_token: config.instagram.accessToken
  }).toString();

  const containerResult = await apiPost(`${baseUrl}/media`, containerParams);
  const containerId = containerResult.id || (containerResult.data && containerResult.data[0]?.id);

  if (!containerId) {
    throw new Error(`Container creation failed: ${JSON.stringify(containerResult)}`);
  }

  log(`✅ Media container created: ${containerId}`);

  // Wait for media to process
  log(`⏳ Waiting for media processing...`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 2: Publish media
  log(`📸 Publishing media...`);
  const publishParams = new URLSearchParams({
    creation_id: containerId,
    access_token: config.instagram.accessToken
  }).toString();

  const publishResult = await apiPost(`${baseUrl}/media_publish`, publishParams);

  if (!publishResult.id) {
    throw new Error(`Publishing failed: ${JSON.stringify(publishResult)}`);
  }

  log(`✅ POSTED! Post ID: ${publishResult.id}`);
  return publishResult.id;
}

// Get current Melbourne time
function getMelbourneTime() {
  const now = new Date();
  const melbourneOffset = 10 * 60 * 60 * 1000; // UTC+10
  const melbourneTime = new Date(now.getTime() + melbourneOffset);
  
  return {
    date: melbourneTime.toISOString().split('T')[0],
    hours: melbourneTime.getUTCHours(),
    minutes: melbourneTime.getUTCMinutes(),
    timeString: `${melbourneTime.getUTCHours().toString().padStart(2, '0')}:${melbourneTime.getUTCMinutes().toString().padStart(2, '0')}`
  };
}

// Write notification file
function writeNotification(post, postId, instagramUrl) {
  const notification = {
    type: 'post_published',
    timestamp: new Date().toISOString(),
    headline: post.headline,
    promotion: post.promotion,
    postId: postId,
    instagramHandle: '@thaijuanc',
    instagramUrl: instagramUrl,
    scheduledTime: post.scheduledTime,
    message: `✅ Post published: ${post.headline}\n📌 Post ID: ${postId}\n🎯 Promotion: ${post.promotion}\n🔗 ${instagramUrl}`
  };
  
  saveJson(NOTIFICATION_PATH, notification);
  log(`📬 Notification written to ${NOTIFICATION_PATH}`);
}

// Fetch Instagram permalink (shortcode URL)
async function fetchInstagramPermalink(postId, config) {
  const url = `https://graph.facebook.com/v18.0/${postId}?fields=permalink&access_token=${config.instagram.accessToken}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.permalink || `https://www.instagram.com/p/${postId}/`);
        } catch (e) {
          resolve(`https://www.instagram.com/p/${postId}/`);
        }
      });
    }).on('error', () => {
      resolve(`https://www.instagram.com/p/${postId}/`);
    });
  });
}

// Main function
async function main() {
  log('🚀 ThaiJuan Instagram Poster (Simple)');

  try {
    // Load config and schedule
    const config = loadJson(CONFIG_PATH);
    const schedule = loadJson(SCHEDULE_PATH);
    let state = loadJson(STATE_PATH);

    // Get current time
    const melbourne = getMelbourneTime();
    log(`📅 Date: ${melbourne.date} | Time: ${melbourne.timeString}`);

    // Find ALL posts due right now
    const postsDue = schedule.posts.filter(post => {
      // Skip if already posted
      if (post.posted) return false;
      
      // Skip if not today
      if (post.date !== melbourne.date) return false;
      
      // Check if scheduled time matches (within 1-minute window)
      return post.scheduledTime === melbourne.timeString;
    });

    if (postsDue.length === 0) {
      log('⏳ No posts due at this time.');
      return;
    }

    log(`📤 Found ${postsDue.length} post(s) due:`);

    // Post ALL due posts
    for (const post of postsDue) {
      log(`\n📌 Posting: ${post.headline} (${post.scheduledTime})...`);

      try {
        const postId = await postToInstagram(post.githubUrl, post.fullCaption, config);

        log(`   ✅ SUCCESS!`);
        log(`   🎯 Promotion: ${post.promotion}`);

        // Fetch proper Instagram permalink (with shortcode)
        log(`   🔗 Fetching Instagram permalink...`);
        const instagramUrl = await fetchInstagramPermalink(postId, config);
        log(`   ✅ Permalink: ${instagramUrl}`);

        // Update post status
        post.posted = true;
        post.postId = postId;
        post.instagramUrl = instagramUrl;

        // Update state
        state.lastPostDate = melbourne.date;
        state.lastPostId = postId;
        state.lastPostUrl = instagramUrl;
        state.updatedAt = new Date().toISOString();

        // Write notification for subagent to send
        writeNotification(post, postId, instagramUrl);
        log(`   📬 Notification queued for subagent DM`);

      } catch (error) {
        log(`   ❌ ERROR: ${error.message}`);
        // Continue with other posts even if one fails
      }
    }

    // Save updated files
    saveJson(SCHEDULE_PATH, schedule);
    saveJson(STATE_PATH, state);
    
    log('\n💾 State and schedule updated');
    log('✅ All due posts processed!');

  } catch (error) {
    log(`❌ FATAL ERROR: ${error.message}`);
    log(`   Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Run
main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
