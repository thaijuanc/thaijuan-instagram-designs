#!/usr/bin/env node

/**
 * ThaiJuan Instagram Auto-Poster (Multi-Post Mode)
 *
 * Posts scheduled Instagram content from campaign schedule.
 * Scans ALL posts and posts any that are due (supports multiple posts per day).
 * Runs every minute via cron.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.join(__dirname, '../../instagram-automation/config.json');
const SCHEDULE_PATH = path.join(__dirname, 'campaign-schedule.json');
const STATE_PATH = path.join(__dirname, 'campaign-state.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

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

async function postToInstagram(imageUrl, caption, config) {
  const baseUrl = `https://graph.facebook.com/v18.0/${config.instagram.instagramBusinessId}`;

  // Step 1: Create media container
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption: caption,
    access_token: config.instagram.accessToken
  }).toString();

  const containerResult = await apiPost(`${baseUrl}/media`, containerParams);

  const containerId = containerResult.id ||
                     (containerResult.data && containerResult.data.length > 0 ? containerResult.data[0].id : null);

  if (!containerId) {
    throw new Error(`Container creation failed: ${JSON.stringify(containerResult)}`);
  }

  console.log(`✅ Media container created: ${containerId}`);

  // Wait for media to process
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 2: Publish media
  const publishParams = new URLSearchParams({
    creation_id: containerId,
    access_token: config.instagram.accessToken
  }).toString();

  const publishResult = await apiPost(`${baseUrl}/media_publish`, publishParams);

  if (!publishResult.id) {
    throw new Error(`Publishing failed: ${JSON.stringify(publishResult)}`);
  }

  return publishResult.id;
}

function getMelbourneTime() {
  // Get current time in Melbourne (UTC+10 or UTC+11 during DST)
  const now = new Date();
  const melbourneOffset = 10 * 60 * 60 * 1000; // UTC+10
  const melbourneTime = new Date(now.getTime() + melbourneOffset);
  return {
    date: melbourneTime.toISOString().split('T')[0],
    hours: melbourneTime.getUTCHours(),
    minutes: melbourneTime.getUTCMinutes()
  };
}

function formatTime(hours, minutes) {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

async function main() {
  console.log('🚀 ThaiJuan Instagram Auto-Poster (Multi-Post Mode)');

  const config = loadJson(CONFIG_PATH);
  const schedule = loadJson(SCHEDULE_PATH);
  let state = loadJson(STATE_PATH);

  // Get current Melbourne time
  const melbourne = getMelbourneTime();
  const currentTime = formatTime(melbourne.hours, melbourne.minutes);

  console.log(`📅 Melbourne Date: ${melbourne.date}`);
  console.log(`🕐 Melbourne Time: ${currentTime}`);
  console.log(`📋 Scanning all scheduled posts...\n`);

  // Find ALL posts due right now (supports multiple posts per day)
  const postsDue = schedule.posts.filter(post => {
    // Skip if already posted
    if (post.posted) return false;
    
    // Skip if not today
    if (post.date !== melbourne.date) return false;
    
    // Check if scheduled time matches current time (within 1-minute window)
    const [scheduledHour, scheduledMinute] = post.scheduledTime.split(':').map(Number);
    
    // Post if hour matches and we're at or past the scheduled minute
    // This handles cron running every minute - will catch the post at the right time
    return melbourne.hours === scheduledHour && melbourne.minutes >= scheduledMinute;
  });

  if (postsDue.length === 0) {
    console.log('⏳ No posts due at this time.\n');
    return;
  }

  console.log(`📤 Found ${postsDue.length} post(s) due for posting:\n`);

  // Post ALL due posts
  for (const post of postsDue) {
    console.log(`📌 Posting: ${post.headline} (${post.scheduledTime})...`);

    try {
      const postId = await postToInstagram(post.githubUrl, post.fullCaption, config);

      console.log(`   ✅ SUCCESS! Post ID: ${postId}`);
      console.log(`   🎯 Promotion: ${post.promotion}\n`);

      // Update post status
      post.posted = true;
      post.postId = postId;

      // Update state
      state.lastPostDate = melbourne.date;
      state.lastPostId = postId;

      // Write notification file for user alert
      const notification = {
        type: 'post_published',
        timestamp: new Date().toISOString(),
        headline: post.headline,
        promotion: post.promotion,
        postId: postId,
        instagramHandle: '@thaijuanc',
        scheduledTime: post.scheduledTime,
        message: `✅ Post published: ${post.headline}\n📌 Post ID: ${postId}\n🎯 Promotion: ${post.promotion}`
      };
      fs.writeFileSync(
        path.join(__dirname, 'notification-pending.json'),
        JSON.stringify(notification, null, 2) + '\n'
      );
      console.log('   📬 Notification queued\n');

    } catch (error) {
      console.error(`   ❌ ERROR: ${error.message}\n`);
      // Continue with other posts even if one fails
    }
  }

  // Save updated schedule and state
  saveJson(SCHEDULE_PATH, schedule);
  saveJson(STATE_PATH, state);
  
  console.log('💾 State and schedule updated\n');
  console.log('✅ All due posts processed!\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
