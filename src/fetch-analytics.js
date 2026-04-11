#!/usr/bin/env node

/**
 * ThaiJuan Instagram Analytics Fetcher
 * 
 * Fetches performance metrics for all Instagram posts.
 * Runs daily at 9 AM via cron.
 * 
 * Metrics tracked:
 * - Impressions, Reach, Likes, Comments, Saves, Shares
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// File paths
const CONFIG_PATH = path.join(__dirname, '../config/config.json');
const SCHEDULE_PATH = path.join(__dirname, '../config/campaign-schedule.json');
const ANALYTICS_PATH = path.join(__dirname, '../config/analytics.json');
const LOG_PATH = '/tmp/thaijuan-analytics.log';

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

// Make GET request to Graph API
function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
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
    req.end();
  });
}

// Fetch metrics for a single post
async function fetchPostMetrics(postId, accessToken) {
  const metrics = [
    'impressions',
    'reach',
    'like_count',
    'comments_count',
    'saved',
    'shares'
  ].join(',');

  const url = `https://graph.facebook.com/v18.0/${postId}?fields=${metrics}&access_token=${accessToken}`;
  
  try {
    const result = await apiGet(url);
    return {
      impressions: result.impressions || 0,
      reach: result.reach || 0,
      likes: result.like_count || 0,
      comments: result.comments_count || 0,
      saves: result.saved || 0,
      shares: result.shares || 0,
      engagement_rate: calculateEngagementRate(result)
    };
  } catch (error) {
    log(`❌ Error fetching metrics for ${postId}: ${error.message}`);
    return null;
  }
}

// Calculate engagement rate
function calculateEngagementRate(metrics) {
  const total = (metrics.like_count || 0) + 
                (metrics.comments_count || 0) + 
                (metrics.saved || 0) + 
                (metrics.shares || 0);
  
  const reach = metrics.reach || 1;
  return ((total / reach) * 100).toFixed(2);
}

// Send Discord webhook
function sendAnalyticsReport(message) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl || webhookUrl === 'YOUR_WEBHOOK_URL_HERE') {
    log('❌ No Discord webhook configured');
    return;
  }

  const payload = Buffer.from(JSON.stringify({
    content: message,
    username: 'ThaiJuan Analytics'
  }));
  
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
      log('✅ Analytics report sent to Discord');
    } else {
      log(`❌ Discord error: ${res.statusCode}`);
    }
  });
  
  req.on('error', (e) => {
    log(`❌ Webhook error: ${e.message}`);
  });
  
  req.write(payload);
  req.end();
}

// Main function
async function main() {
  log('📊 ThaiJuan Analytics Fetcher');

  try {
    // Load config and schedule
    const config = loadJson(CONFIG_PATH);
    const schedule = loadJson(SCHEDULE_PATH);
    let analytics = {};
    
    // Load existing analytics if available
    if (fs.existsSync(ANALYTICS_PATH)) {
      analytics = loadJson(ANALYTICS_PATH);
    }

    // Get current date
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    log(`📅 Fetching analytics for posts up to ${today}`);

    // Find all posted content
    const postedPosts = schedule.posts.filter(post => post.posted === true);
    
    log(`📈 Found ${postedPosts.length} posted posts`);

    // Fetch metrics for each post
    let updated = 0;
    let failed = 0;

    for (const post of postedPosts) {
      const postKey = post.githubUrl.split('/').pop().replace('.png', '');
      
      // Skip if already fetched today
      if (analytics[postKey] && analytics[postKey].fetchedAt.startsWith(today)) {
        log(`⏭️  Skipped ${postKey} (already fetched today)`);
        continue;
      }

      log(`📊 Fetching: ${post.headline} (${post.postId})...`);

      const metrics = await fetchPostMetrics(post.postId, config.instagram.accessToken);

      if (metrics) {
        analytics[postKey] = {
          postId: post.postId,
          headline: post.headline,
          promotion: post.promotion,
          postedAt: new Date().toISOString(),
          metrics: metrics,
          fetchedAt: new Date().toISOString()
        };
        updated++;
        log(`✅ Updated: ${postKey}`);
      } else {
        failed++;
      }
    }

    // Save analytics
    saveJson(ANALYTICS_PATH, analytics);
    log(`💾 Saved analytics for ${updated} posts (${failed} failed)`);

    // Generate daily report
    const dailyPosts = postedPosts.filter(post => {
      const postDate = post.date;
      return postDate === yesterday || postDate === today;
    });

    if (dailyPosts.length > 0) {
      const report = generateDailyReport(dailyPosts, analytics);
      sendAnalyticsReport(report);
    }

    log('✅ Analytics fetch complete!');

  } catch (error) {
    log(`❌ FATAL ERROR: ${error.message}`);
    log(`   Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Generate daily report
function generateDailyReport(posts, analytics) {
  let message = '📊 **Daily Analytics Report**\n\n';
  
  let totalImpressions = 0;
  let totalReach = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalSaves = 0;
  let bestPost = null;
  let bestEngagement = 0;

  posts.forEach(post => {
    const postKey = post.githubUrl.split('/').pop().replace('.png', '');
    const data = analytics[postKey];
    
    if (data && data.metrics) {
      const m = data.metrics;
      totalImpressions += m.impressions;
      totalReach += m.reach;
      totalLikes += m.likes;
      totalComments += m.comments;
      totalSaves += m.saves;
      
      if (parseFloat(m.engagement_rate) > bestEngagement) {
        bestEngagement = parseFloat(m.engagement_rate);
        bestPost = post.headline;
      }
    }
  });

  message += `**Posts:** ${posts.length}\n`;
  message += `**Impressions:** ${totalImpressions.toLocaleString()}\n`;
  message += `**Reach:** ${totalReach.toLocaleString()}\n`;
  message += `**Likes:** ${totalLikes}\n`;
  message += `**Comments:** ${totalComments}\n`;
  message += `**Saves:** ${totalSaves}\n`;
  
  if (bestPost) {
    message += `\n🏆 **Best Performer:** ${bestPost}\n`;
    message += `   Engagement Rate: ${bestEngagement}%\n`;
  }

  return message;
}

// Run
main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
