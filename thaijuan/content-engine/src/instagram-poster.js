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
const { loadDotEnv } = require('./lib/env');

loadDotEnv();

// File paths
const CONFIG_PATH = path.join(__dirname, '../config/config.json');
const SCHEDULE_PATH = path.join(__dirname, '../config/campaign-schedule.json');
const STATE_PATH = path.join(__dirname, '../config/campaign-state.json');
const LOG_PATH = '/tmp/thaijuan-instagram.log';

function parseArgs(argv = process.argv.slice(2)) {
  return {
    dryRun: argv.includes('--dry-run') || process.env.INSTAGRAM_DRY_RUN === 'true'
  };
}

// Load JSON file
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return loadJson(filePath);
}

// Save JSON file
function saveJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function loadInstagramConfig() {
  const fileConfig = loadJsonIfExists(CONFIG_PATH, {});
  const instagram = fileConfig.instagram || {};
  return {
    ...fileConfig,
    instagram: {
      instagramBusinessId: instagram.instagramBusinessId || process.env.INSTAGRAM_BUSINESS_ID,
      accessToken: instagram.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN
    }
  };
}

function assertInstagramConfig(config) {
  if (!config.instagram?.instagramBusinessId) throw new Error('Missing Instagram business ID. Set INSTAGRAM_BUSINESS_ID or config/config.json.');
  if (!config.instagram?.accessToken) throw new Error('Missing Instagram access token. Set INSTAGRAM_ACCESS_TOKEN or config/config.json.');
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
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const hours = Number(parts.hour);
  const minutes = Number(parts.minute);

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hours,
    minutes,
    timeString: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  };
}

// Send Discord webhook notification
function sendDiscordWebhook(post, postId, instagramUrl) {
  const message = `✅ **Post Published!**\n\n📌 **${post.headline}**\n🎯 ${post.promotion}\n🔗 ${instagramUrl}\n\nPosted at ${new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Melbourne' })}`;
  
  const payload = Buffer.from(JSON.stringify({
    content: message,
    username: 'ThaiJuan Bot'
  }));
  
  // Send to notifications channel
  const webhooks = [
    process.env.DISCORD_WEBHOOK_URL
  ].filter(url => url && url !== 'YOUR_WEBHOOK_URL_HERE');
  
  webhooks.forEach((webhookUrl, index) => {
    const url = new URL(webhookUrl);
    
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
      if (res.statusCode === 204 || res.statusCode === 200) {
        log(`✅ Discord notification sent (${index === 0 ? 'channel' : 'direct'})`);
      } else {
        log(`❌ Discord error (${index === 0 ? 'channel' : 'direct'}): ${res.statusCode}`);
      }
    });
    
    req.on('error', (e) => {
      log(`❌ Webhook error (${index === 0 ? 'channel' : 'direct'}): ${e.message}`);
    });
    
    req.write(payload);
    req.end();
  });
}

// Write notification file (backup)
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
  log(`📬 Backup notification written to ${NOTIFICATION_PATH}`);
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
  const args = parseArgs();
  log('🚀 ThaiJuan Instagram Poster (Simple)');

  try {
    // Load schedule first so checks can run without Instagram credentials when nothing is due.
    const schedule = loadJsonIfExists(SCHEDULE_PATH, { posts: [] });
    let state = loadJsonIfExists(STATE_PATH, {});

    // Get current time
    const melbourne = getMelbourneTime();
    log(`📅 Date: ${melbourne.date} | Time: ${melbourne.timeString}`);

    // Find ALL posts due right now
    const postsDue = schedule.posts.filter(post => {
      // Skip if already posted
      if (post.posted) return false;

      // Skip paused/draft posts
      if (post.status && post.status !== 'scheduled') return false;
      
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
    const config = args.dryRun ? null : loadInstagramConfig();
    if (!args.dryRun) assertInstagramConfig(config);

    // Post ALL due posts
    for (const post of postsDue) {
      log(`\n📌 Posting: ${post.headline} (${post.scheduledTime})...`);

      try {
        if (args.dryRun) {
          log(`   🧪 Dry run: would post ${post.githubUrl}`);
          continue;
        }

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

        // Send Discord webhook IMMEDIATELY
        sendDiscordWebhook(post, postId, instagramUrl);
        
        // Also write backup notification file
        // writeNotification(post, postId, instagramUrl); // Deprecated

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
