#!/usr/bin/env node

/**
 * Canva MCP Auth Preflight
 *
 * Runs before design generation to catch expired Canva auth early.
 */

const { execFileSync } = require('child_process');
const path = require('path');
const { ROOT } = require('../lib/files');
const { log } = require('../lib/log');

function runCanvaAuthPreflight() {
  const cwd = path.resolve(ROOT, '..', '..');

  try {
    execFileSync('mcporter', ['list', 'Canva', '--output', 'json'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000
    });

    const stdout = execFileSync('mcporter', [
      'call',
      'Canva.search-designs',
      '--args',
      JSON.stringify({
        query: 'Melbourne Food',
        ownership: 'owned',
        sort_by: 'relevance',
        user_intent: 'Preflight Canva MCP auth before generating Instagram restaurant design'
      }),
      '--output',
      'json'
    ], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 90000,
      maxBuffer: 1024 * 1024 * 10
    });

    const result = JSON.parse(stdout);
    if (result.isError) {
      throw new Error(result.content?.map((item) => item.text).join('\n') || 'Canva MCP auth preflight failed');
    }

    return { ok: true, itemCount: result.items?.length || 0 };
  } catch (error) {
    return { ok: false, error: error.stderr?.toString?.() || error.message || String(error) };
  }
}

if (require.main === module) {
  const result = runCanvaAuthPreflight();
  if (!result.ok) {
    console.error(`❌ Canva auth preflight failed: ${result.error}`);
    process.exit(1);
  }
  log(`✅ Canva auth preflight passed (${result.itemCount} design result(s) returned).`);
}

module.exports = { runCanvaAuthPreflight };
