#!/usr/bin/env node

/**
 * Daily Social Growth Agent Runner
 *
 * MVP workflow:
 * 1. Canva auth preflight scaffold
 * 2. Discover restaurant candidates
 * 3. Score candidates
 * 4. Create one content draft
 * 5. Create Canva MCP brief for a fresh design
 *
 * This stops before publishing. Juan approval + Canva MCP execution come next.
 */

const { log } = require('./lib/log');
const { discoverRestaurants } = require('./agents/research-agent');
const { enrichRestaurants } = require('./agents/enrichment-agent');
const { scoreRestaurants } = require('./agents/scoring-agent');
const { createNextDraft } = require('./agents/content-agent');
const { createBriefForNextDraft } = require('./agents/canva-agent');
const { runCanvaAuthPreflight } = require('./agents/canva-auth-preflight');
const { executeCanvaForNextDraft } = require('./agents/canva-execute-agent');

async function runDailyWorkflow(options = {}) {
  log('🚀 Starting Daily Social Growth Agent workflow');

  log('🔎 Discovering restaurants...');
  const { allRestaurants } = await discoverRestaurants();
  log(`   Found/loaded ${allRestaurants.length} total restaurant(s).`);

  log('🧠 Enriching restaurant details...');
  const { restaurants: enrichedRestaurants } = await enrichRestaurants(allRestaurants, { limit: 10 });
  log('   Enrichment complete.');

  log('📊 Scoring restaurants...');
  const { scored } = scoreRestaurants(enrichedRestaurants);
  log(`   Top pick: ${scored[0]?.name || 'none'} (${scored[0]?.score || 'n/a'})`);

  log('✍️ Creating content draft...');
  const { draft } = createNextDraft(scored);
  log(`   Draft: ${draft.restaurantName} — ${draft.hook}`);

  log('🎨 Creating Canva MCP brief...');
  const { path: briefPath } = await createBriefForNextDraft();
  log(`   Brief: ${briefPath}`);

  let canvaResult = null;
  if (options.withCanva) {
    log('🔐 Running Canva MCP auth preflight...');
    const auth = runCanvaAuthPreflight();
    if (!auth.ok) throw new Error(`Canva auth preflight failed: ${auth.error}`);
    log(`   Canva auth healthy (${auth.itemCount} result(s)).`);

    log('🎨 Executing Canva MCP design generation/export...');
    canvaResult = await executeCanvaForNextDraft();
    log(`   Canva design: ${canvaResult.designUrl}`);
  }

  log(options.withCanva
    ? '✅ Daily workflow complete. Draft is ready for review.'
    : '✅ Daily workflow complete. Next step: run the Canva MCP design agent using the generated brief, then approve/schedule.');

  return { draft, briefPath, canvaResult };
}

if (require.main === module) {
  runDailyWorkflow({ withCanva: process.argv.includes('--with-canva') }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runDailyWorkflow };
