#!/usr/bin/env node

/**
 * Canva Quality Agent
 *
 * Rejects Canva outputs that are pretty but strategically wrong.
 * Current available Canva MCP tools expose rich text content, so this gate
 * validates text/copy discipline. Visual review can be added later with a
 * screenshot/image model step outside Canva MCP.
 */

const path = require('path');
const { execFileSync } = require('child_process');
const { DATA_DIR, ROOT, readJson, writeJson } = require('../lib/files');
const { log } = require('../lib/log');

const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');

const BANNED_PATTERNS = [
  /\bbest\b/i,
  /\bmust[-\s]?visit\b/i,
  /\b#?1\b/i,
  /\bnumber one\b/i,
  /\baward[-\s]?winning\b/i,
  /\bhidden gem\b/i,
  /\bauthentic\b/i,
  /\bultimate\b/i,
  /\bunbeatable\b/i,
  /\bworld[-\s]?class\b/i,
  /@reallygreatsite/i,
  /lorem ipsum/i,
  /your text here/i,
  /placeholder/i
];

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mcporterCall(tool, args) {
  const stdout = execFileSync('mcporter', [
    'call',
    `Canva.${tool}`,
    '--args',
    JSON.stringify(args),
    '--output',
    'json'
  ], {
    cwd: path.resolve(ROOT, '..', '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024 * 20
  });

  const result = JSON.parse(stdout);
  if (result.isError) {
    const message = result.content?.map((item) => item.text).join('\n') || `Canva MCP ${tool} failed`;
    throw new Error(message);
  }
  return result;
}

function getDesignText(designId) {
  const result = mcporterCall('get-design-content', {
    design_id: designId,
    content_types: ['richtexts'],
    pages: [1],
    user_intent: 'Inspect generated Canva design text for quality gate'
  });

  return (result.content || [])
    .map((item) => item.text || '')
    .join('\n')
    .trim();
}

function requiredCopyChecks(draft) {
  const design = draft.contentPackage?.design || {};
  const checks = [];

  if (draft.restaurantName) checks.push({ id: 'restaurant_name', label: draft.restaurantName, required: true });
  if (design.headline) checks.push({ id: 'headline', label: design.headline, required: true });

  // Exact long subtitles are often reformatted by Canva, so require the core hook terms instead.
  const source = `${design.subtitle || draft.description || ''} ${(design.bullets || []).join(' ')}`;
  const keywordGroups = [];
  if (/yum cha/i.test(source)) keywordGroups.push({ id: 'yum_cha_hook', any: ['yum cha'] });
  if (/cocktail/i.test(source)) keywordGroups.push({ id: 'cocktail_hook', any: ['cocktail', 'cocktails'] });
  if (/bao/i.test(source)) keywordGroups.push({ id: 'bao_hook', any: ['bao'] });
  if (/dumpling/i.test(source)) keywordGroups.push({ id: 'dumpling_hook', any: ['dumpling', 'dumplings'] });
  if (/book ahead/i.test(source)) keywordGroups.push({ id: 'book_ahead_hook', any: ['book ahead', 'book'] });
  if (/save/i.test(design.cta || draft.cta || '')) keywordGroups.push({ id: 'save_cta', any: ['save'] });

  return { checks, keywordGroups };
}

function evaluateDesignText({ designText, draft }) {
  const issues = [];
  const warnings = [];
  const text = normalise(designText);
  const raw = designText || '';

  if (!text) issues.push('No readable text found in Canva design.');

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(raw)) issues.push(`Banned or risky copy found: ${pattern}`);
  }

  const { checks, keywordGroups } = requiredCopyChecks(draft);

  for (const check of checks) {
    if (!text.includes(normalise(check.label))) {
      issues.push(`Missing required copy: ${check.label}`);
    }
  }

  let hookHits = 0;
  for (const group of keywordGroups) {
    const hit = group.any.some((term) => text.includes(normalise(term)));
    if (hit) hookHits += 1;
    else if (group.id === 'save_cta') issues.push(`Missing required hook/copy keyword group: ${group.id}`);
    else warnings.push(`Missing optional hook keyword group: ${group.id}`);
  }

  if (keywordGroups.length > 0 && hookHits < Math.min(3, keywordGroups.length)) {
    issues.push('Design does not include enough hook/reason-to-go copy.');
  }

  if ((draft.contentPackage?.design?.cta || draft.cta) && !text.includes('save')) {
    issues.push('Missing save/share CTA copy.');
  }

  if (/food save/i.test(raw)) issues.push('Awkward phrase found: food save.');
  if (/chachingdinner/i.test(raw.replace(/\s+/g, ''))) issues.push('Awkward merged brand text found: ChaChingDinner.');

  return {
    passed: issues.length === 0,
    issues,
    warnings,
    designText,
    checkedAt: new Date().toISOString()
  };
}

function runQualityGate({ designId, draft }) {
  if (!designId) throw new Error('Missing designId for quality gate.');
  if (!draft) throw new Error('Missing draft for quality gate.');

  const designText = getDesignText(designId);
  return evaluateDesignText({ designText, draft });
}

function runQualityGateForDraftDesign(draftId, designId) {
  const drafts = readJson(DRAFTS_PATH, []);
  const draft = drafts.find((item) => item.id === draftId) || drafts[0];
  if (!draft) throw new Error('No draft found for quality gate.');
  return runQualityGate({ designId: designId || draft.canva?.designId, draft });
}

if (require.main === module) {
  const designArg = process.argv.find((arg) => arg.startsWith('--design-id='));
  const draftArg = process.argv.find((arg) => arg.startsWith('--draft-id='));
  const designId = designArg ? designArg.split('=')[1] : undefined;
  const draftId = draftArg ? draftArg.split('=')[1] : undefined;

  try {
    const result = runQualityGateForDraftDesign(draftId, designId);
    if (!result.passed) {
      console.error(`❌ Canva quality gate failed:\n- ${result.issues.join('\n- ')}`);
      if (result.designText) console.error(`\nExtracted text:\n${result.designText}`);
      process.exit(1);
    }
    log('✅ Canva quality gate passed.');
    if (result.warnings.length) log(`Warnings: ${result.warnings.join('; ')}`);
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { runQualityGate, evaluateDesignText, getDesignText };
