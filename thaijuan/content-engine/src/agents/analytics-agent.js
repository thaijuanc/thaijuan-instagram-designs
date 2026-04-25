#!/usr/bin/env node

/**
 * Analytics Agent
 * Placeholder for Instagram Insights collection.
 *
 * Next implementation:
 * - Read posted items from campaign-schedule.json
 * - Fetch Instagram Insights at 2h, 24h, and 7d windows
 * - Store snapshots in data/analytics.json
 */

const path = require('path');
const { DATA_DIR, readJson, writeJson } = require('../lib/files');
const { log } = require('../lib/log');

const ANALYTICS_PATH = path.join(DATA_DIR, 'analytics.json');

function collectAnalyticsPlaceholder() {
  const analytics = readJson(ANALYTICS_PATH, []);
  writeJson(ANALYTICS_PATH, analytics);
  return { count: analytics.length, path: ANALYTICS_PATH };
}

if (require.main === module) {
  const { count, path: outPath } = collectAnalyticsPlaceholder();
  log(`🛠️ Analytics Agent ready. Existing snapshots: ${count}. File: ${outPath}`);
}

module.exports = { collectAnalyticsPlaceholder };
