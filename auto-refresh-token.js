#!/usr/bin/env node

/**
 * Canva MCP Token Auto-Refresh
 * 
 * Checks token expiry and refreshes before expiration.
 * Runs every 3 hours via cron (tokens expire in 3.5 hours).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CREDENTIALS_PATH = path.join(process.env.HOME, '.mcporter', 'credentials.json');
const ENV_PATH = path.join(__dirname, '../.env');
const LOG_PATH = '/tmp/thaijuan-token-refresh.log';

function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(LOG_PATH, logEntry);
}

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('Credentials file not found. Run "mcporter auth canva-mcp" first.');
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
}

function saveCredentials(credentials) {
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2) + '\n');
}

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error('.env file not found.');
  }
  const envContent = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  });
  return env;
}

function checkTokenExpiry(tokens) {
  const expiresInSeconds = tokens.expires_in || 0;
  const expiresInMillis = expiresInSeconds * 1000;
  
  // We don't have the exact issued_at time, so we'll refresh proactively
  // Refresh if expires_in is less than 30 minutes (1800 seconds)
  const refreshThreshold = 1800; // 30 minutes
  
  if (expiresInSeconds < refreshThreshold) {
    log(`⚠️  Token expires in ${expiresInSeconds}s (${Math.floor(expiresInSeconds / 60)} min) - REFRESHING`);
    return true; // Needs refresh
  }
  
  log(`✅ Token valid for ${expiresInSeconds}s (${Math.floor(expiresInSeconds / 60)} min) - NO ACTION`);
  return false; // Still valid
}

function refreshToken(clientId, clientSecret, refreshTokenValue) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
      client_id: clientId,
      client_secret: clientSecret
    });

    const options = {
      hostname: 'canva.com',
      port: 443,
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  log('🔄 Starting token refresh check...');

  try {
    // Load credentials
    const credentials = loadCredentials();
    const canvaEntry = credentials.entries['canva-mcp|9161bf34d7c223cc'];
    
    if (!canvaEntry) {
      throw new Error('Canva MCP credentials not found. Run "mcporter auth canva-mcp" first.');
    }

    const { tokens } = canvaEntry;
    
    // Check if refresh is needed
    if (!checkTokenExpiry(tokens)) {
      log('✅ No refresh needed. Exiting.');
      return;
    }

    // Load Canva credentials from .env
    const env = loadEnv();
    const clientId = env.CANVA_CLIENT_ID;
    const clientSecret = env.CANVA_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('CANVA_CLIENT_ID or CANVA_CLIENT_SECRET missing from .env');
    }

    log('📡 Requesting new token from Canva...');

    // Refresh token
    const refreshResult = await refreshToken(clientId, clientSecret, tokens.refresh_token);

    if (!refreshResult.access_token) {
      throw new Error(`Token refresh failed: ${JSON.stringify(refreshResult)}`);
    }

    log(`✅ Token refreshed successfully!`);
    log(`   New expiry: ${refreshResult.expires_in}s (${Math.floor(refreshResult.expires_in / 60)} min)`);

    // Update credentials with new tokens
    canvaEntry.tokens = {
      access_token: refreshResult.access_token,
      token_type: refreshResult.token_type || 'bearer',
      expires_in: refreshResult.expires_in,
      scope: refreshResult.scope || '',
      refresh_token: refreshResult.refresh_token || tokens.refresh_token // Keep old if not provided
    };

    canvaEntry.updatedAt = new Date().toISOString();

    // Save updated credentials
    saveCredentials(credentials);
    log('💾 Credentials updated successfully');
    log('🎉 Token refresh complete!');

  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
    log(`   Stack: ${error.stack}`);
    
    // Write error notification
    const errorNotification = {
      type: 'token_refresh_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
      message: `⚠️ Canva token refresh failed: ${error.message}\n\nPlease re-authorize: mcporter auth canva-mcp`
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'token-refresh-error.json'),
      JSON.stringify(errorNotification, null, 2) + '\n'
    );
    
    process.exit(1);
  }
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
