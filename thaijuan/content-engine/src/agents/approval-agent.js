#!/usr/bin/env node

/**
 * Approval Agent
 *
 * Marks a draft as approved after Juan/Bob review. This does not publish.
 * Publisher Agent later moves approved drafts into campaign-schedule.json.
 */

const fs = require('fs');
const path = require('path');
const { DATA_DIR, readJson, writeJson } = require('../lib/files');
const { normalizeRepoPath, toRawGithubUrl, isHttpUrl } = require('../lib/github-url');
const { log } = require('../lib/log');

const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (const arg of argv) {
    if (arg === '--force') args.force = true;
    else if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      args[key] = rest.join('=') || true;
    }
  }
  return args;
}

function assertDraftCanBeApproved(draft, options = {}) {
  if (options.force) return;

  const issues = [];
  if (!['ready_for_review', 'approved'].includes(draft.approvalStatus)) {
    issues.push(`approvalStatus is ${draft.approvalStatus}, expected ready_for_review`);
  }
  if (draft.canva?.qualityGate && draft.canva.qualityGate.passed !== true) {
    issues.push('Canva text quality gate has not passed');
  }
  if (draft.canva?.visualQualityGate && draft.canva.visualQualityGate.passed !== true) {
    issues.push('Visual quality gate has not passed');
  }
  if (!draft.canva?.exportedAssetPath && !draft.canva?.exportedAssetUrl && !draft.githubUrl) {
    issues.push('No exported asset path/url found');
  }

  if (issues.length) {
    throw new Error(`Draft is not safe to approve without --force:\n- ${issues.join('\n- ')}`);
  }
}

function resolveAsset({ draft, assetPath, assetUrl }) {
  const source = assetUrl || assetPath || draft.githubUrl || draft.canva?.exportedAssetUrl || draft.canva?.exportedAssetPath;
  if (!source) throw new Error('No asset provided/found for approval.');

  if (isHttpUrl(source)) {
    return {
      githubUrl: source,
      assetLocalPath: draft.canva?.exportedAssetPath || null,
      assetRepoPath: draft.canva?.exportedAssetPath ? normalizeRepoPath(draft.canva.exportedAssetPath) : null,
      assetNeedsPush: false
    };
  }

  const repoPath = normalizeRepoPath(source);
  const absolute = path.resolve(process.cwd(), repoPath);
  if (!fs.existsSync(absolute)) throw new Error(`Approved asset does not exist locally: ${absolute}`);

  return {
    githubUrl: toRawGithubUrl(repoPath),
    assetLocalPath: repoPath,
    assetRepoPath: repoPath,
    assetNeedsPush: true
  };
}

function approveDraft(options = {}) {
  const drafts = readJson(DRAFTS_PATH, []);
  const draftId = options['draft-id'] || options.draftId;
  const draft = draftId ? drafts.find((item) => item.id === draftId) : drafts[0];
  if (!draft) throw new Error('No draft found to approve.');

  assertDraftCanBeApproved(draft, options);
  const asset = resolveAsset({ draft, assetPath: options['asset-path'], assetUrl: options['asset-url'] });

  const updatedDrafts = drafts.map((item) => {
    if (item.id !== draft.id) return item;
    return {
      ...item,
      suggestedTime: options.time || item.suggestedTime || '18:00',
      date: options.date || item.date,
      githubUrl: asset.githubUrl,
      assetLocalPath: asset.assetLocalPath,
      assetRepoPath: asset.assetRepoPath,
      assetNeedsPush: asset.assetNeedsPush,
      approvalStatus: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: options.by || 'Juan/Bob review',
      approvalNotes: options.notes || item.approvalNotes || null
    };
  });

  writeJson(DRAFTS_PATH, updatedDrafts);
  return { draftId: draft.id, githubUrl: asset.githubUrl, assetNeedsPush: asset.assetNeedsPush };
}

if (require.main === module) {
  try {
    const result = approveDraft(parseArgs());
    log(`✅ Draft approved: ${result.draftId}`);
    log(`   Asset URL: ${result.githubUrl}`);
    if (result.assetNeedsPush) log('   Note: asset must be committed/pushed before Instagram can fetch the GitHub raw URL.');
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { approveDraft, assertDraftCanBeApproved, resolveAsset };
