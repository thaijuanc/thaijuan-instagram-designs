#!/usr/bin/env node

/**
 * Canva Execute Agent
 *
 * Canva generates 4 candidates by default. This agent now evaluates the whole
 * batch, picks the best candidate, exports that one, and marks it ready.
 * Hard disqualifiers still block obviously unsafe/broken outputs.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');
const { DATA_DIR, ROOT, readJson, writeJson, ensureDir, slugify } = require('../lib/files');
const { log } = require('../lib/log');
const { runQualityGate } = require('./canva-quality-agent');
const { selectBestCandidate } = require('./candidate-selection-agent');

const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');
const DESIGNS_DIR = path.join(ROOT, 'designs', 'generated');

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

function downloadFile(url, outPath) {
  ensureDir(path.dirname(outPath));
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(outPath);
        return downloadFile(response.headers.location, outPath).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(outPath, () => {});
        return reject(new Error(`Download failed: ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (error) => {
      file.close();
      fs.unlink(outPath, () => {});
      reject(error);
    });
  });
}

function getCandidates(generationResult) {
  const candidates = generationResult.job?.result?.generated_designs || [];
  if (candidates.length === 0) throw new Error('Canva returned no generated design candidates.');
  return candidates;
}

function uploadBriefAssets(brief) {
  const urls = (brief.assetUrls || []).slice(0, 4);
  const assetIds = [];

  for (const [index, url] of urls.entries()) {
    try {
      const result = mcporterCall('upload-asset-from-url', {
        url,
        name: `${brief.restaurantName || 'restaurant'} official image ${index + 1}`,
        user_intent: 'Upload official restaurant imagery for a Canva Instagram recommendation design'
      });
      const assetId = result.job?.asset?.id;
      if (assetId) assetIds.push(assetId);
    } catch (error) {
      log(`⚠️ Could not upload Canva asset from ${url}: ${error.message}`);
    }
  }

  return assetIds;
}

function getNextCanvaDraft() {
  const drafts = readJson(DRAFTS_PATH, []);
  return drafts.find((item) => item.approvalStatus === 'awaiting_canva_design' && item.canva?.briefPath) || null;
}

function buildStrictPrompt(brief, feedback = []) {
  const basePrompt = brief.prompt || 'Create a fresh Canva Instagram restaurant recommendation design.';
  if (!feedback.length) return basePrompt;
  return `${basePrompt}\n\nAvoid these issues from previous attempts:\n${feedback.slice(-10).map((item, index) => `${index + 1}. ${item}`).join('\n')}`;
}

function hasHardDisqualifier(textQuality) {
  const issues = textQuality.issues || [];
  return issues.some((issue) =>
    /Banned or risky copy|placeholder|@reallygreatsite|Missing required copy/i.test(issue)
  );
}

function textQualityScore(textQuality) {
  let score = 10;
  score -= (textQuality.issues || []).length * 2;
  score -= (textQuality.warnings || []).length * 0.5;
  if (hasHardDisqualifier(textQuality)) score -= 10;
  return Math.max(0, Math.round(score * 10) / 10);
}

async function exportCandidate({ candidateDesign, candidate, draft, attempt, index }) {
  const designId = candidateDesign.design_summary.id;
  const exported = mcporterCall('export-design', {
    design_id: designId,
    format: {
      type: 'png',
      width: 1080,
      height: 1350,
      export_quality: 'regular',
      pages: [1]
    },
    user_intent: 'Export Canva candidate as PNG for batch quality selection'
  });

  const exportUrl = exported.job?.urls?.[0];
  if (!exportUrl) throw new Error('Canva export did not return a download URL.');

  const outputName = `${draft.date}-${slugify(draft.restaurantName)}-candidate-${attempt}-${index + 1}.png`;
  const outputPath = path.join(DESIGNS_DIR, outputName);
  await downloadFile(exportUrl, outputPath);
  return { exportUrl, exportJobId: exported.job.id, outputPath };
}

function updateFailure({ draft, drafts, status, assetIds, rejectedDesigns, feedbackLog, message }) {
  const updated = drafts.map((item) => item.id !== draft.id ? item : {
    ...item,
    canva: {
      ...item.canva,
      status,
      uploadedAssetIds: assetIds,
      rejectedDesigns: [
        ...(item.canva?.rejectedDesigns || []),
        ...rejectedDesigns
      ],
      regenerationFeedback: feedbackLog,
      failureMessage: message,
      updatedAt: new Date().toISOString()
    },
    approvalStatus: 'needs_design_revision'
  });
  writeJson(DRAFTS_PATH, updated);
}

async function executeCanvaForNextDraft(options = {}) {
  const maxAttempts = Number(options.maxAttempts || process.env.CANVA_MAX_ATTEMPTS || 2);
  let drafts = readJson(DRAFTS_PATH, []);
  const draft = getNextCanvaDraft();
  if (!draft) throw new Error('No draft awaiting Canva design.');

  const brief = readJson(draft.canva.briefPath, null);
  if (!brief) throw new Error(`Missing Canva brief: ${draft.canva.briefPath}`);

  log(`🎨 Generating Canva designs for ${draft.restaurantName}...`);
  const assetIds = uploadBriefAssets(brief);
  if (assetIds.length) log(`   Uploaded ${assetIds.length} official image asset(s) to Canva.`);

  const allRejectedDesigns = [];
  const feedbackLog = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    log(`   Attempt ${attempt}/${maxAttempts}: generating batch...`);
    const generation = mcporterCall('generate-design', {
      query: buildStrictPrompt(brief, feedbackLog),
      design_type: 'instagram_post',
      ...(assetIds.length ? { asset_ids: assetIds } : {}),
      user_intent: `Generate Canva Instagram design batch ${attempt} for Melbourne restaurant recommendation`
    });

    const selectable = [];
    const candidates = getCandidates(generation);

    for (const [index, candidate] of candidates.entries()) {
      log(`   Preparing candidate ${index + 1}/${candidates.length}: ${candidate.candidate_id}`);
      const candidateDesign = mcporterCall('create-design-from-candidate', {
        job_id: generation.job.id,
        candidate_id: candidate.candidate_id,
        user_intent: 'Create editable Canva design from candidate for batch selection'
      });

      const designId = candidateDesign.design_summary.id;
      const textQuality = runQualityGate({ designId, draft });
      const hardFail = hasHardDisqualifier(textQuality);
      const score = textQualityScore(textQuality);

      if (hardFail) {
        allRejectedDesigns.push({
          attempt,
          candidateId: candidate.candidate_id,
          designId,
          designUrl: candidateDesign.design_summary.urls.edit_url,
          gate: 'hard_text',
          textQualityScore: score,
          issues: textQuality.issues,
          warnings: textQuality.warnings,
          designText: textQuality.designText,
          rejectedAt: new Date().toISOString()
        });
        feedbackLog.push(...(textQuality.issues || []));
        log(`   ❌ Hard rejected candidate ${index + 1}: ${textQuality.issues.join('; ')}`);
        continue;
      }

      const exported = await exportCandidate({ candidateDesign, candidate, draft, attempt, index });
      selectable.push({
        attempt,
        index,
        candidateId: candidate.candidate_id,
        candidateUrl: candidate.url,
        designId,
        designUrl: candidateDesign.design_summary.urls.edit_url,
        viewUrl: candidateDesign.design_summary.urls.view_url,
        textQuality,
        textQualityScore: score,
        ...exported
      });
      log(`   ✅ Candidate ${index + 1} selectable (text score ${score}/10).`);
    }

    if (!selectable.length) {
      log('   No selectable candidates in this batch. Regenerating if attempts remain.');
      continue;
    }

    log(`   Ranking ${selectable.length} selectable candidate(s)...`);
    const selection = await selectBestCandidate({ draft, candidates: selectable });
    const selected = selection.selected;

    if (selection.recommendation === 'regenerate' && attempt < maxAttempts) {
      feedbackLog.push(selection.summary, ...(selection.issues || []));
      allRejectedDesigns.push(...selectable.map((candidate) => ({
        attempt,
        candidateId: candidate.candidateId,
        designId: candidate.designId,
        designUrl: candidate.designUrl,
        assetPath: path.relative(path.resolve(ROOT, '..', '..'), candidate.outputPath),
        gate: 'batch_visual_regenerate',
        selectionSummary: selection.summary,
        rejectedAt: new Date().toISOString()
      })));
      log(`   Batch selector requested regeneration: ${selection.summary}`);
      continue;
    }

    log(`   🏆 Selected candidate ${selected.candidateId} (${selection.winnerScore || 'n/a'}/10).`);
    drafts = readJson(DRAFTS_PATH, []);
    const updatedDrafts = drafts.map((item) => item.id !== draft.id ? item : {
      ...item,
      canva: {
        ...item.canva,
        status: 'exported_ready_for_review',
        generationJobId: generation.job.id,
        uploadedAssetIds: assetIds,
        selectedCandidateId: selected.candidateId,
        candidateUrl: selected.candidateUrl,
        designId: selected.designId,
        designUrl: selected.designUrl,
        viewUrl: selected.viewUrl,
        qualityGate: selected.textQuality,
        candidateSelection: selection,
        rejectedDesigns: [
          ...(item.canva?.rejectedDesigns || []),
          ...allRejectedDesigns,
          ...selectable
            .filter((candidate) => candidate.candidateId !== selected.candidateId)
            .map((candidate) => ({
              attempt,
              candidateId: candidate.candidateId,
              designId: candidate.designId,
              designUrl: candidate.designUrl,
              assetPath: path.relative(path.resolve(ROOT, '..', '..'), candidate.outputPath),
              gate: 'not_selected',
              rejectedAt: new Date().toISOString()
            }))
        ],
        exportJobId: selected.exportJobId,
        exportDownloadUrl: selected.exportUrl,
        exportedAssetPath: path.relative(path.resolve(ROOT, '..', '..'), selected.outputPath),
        updatedAt: new Date().toISOString()
      },
      approvalStatus: 'ready_for_review'
    });

    writeJson(DRAFTS_PATH, updatedDrafts);
    return {
      draftId: draft.id,
      designId: selected.designId,
      outputPath: selected.outputPath,
      designUrl: selected.designUrl,
      viewUrl: selected.viewUrl,
      selection
    };
  }

  drafts = readJson(DRAFTS_PATH, []);
  updateFailure({
    drafts,
    draft,
    status: 'batch_selection_failed',
    assetIds,
    rejectedDesigns: allRejectedDesigns,
    feedbackLog,
    message: `No Canva candidate selected after ${maxAttempts} batch attempt(s).`
  });
  throw new Error(`No Canva candidate selected after ${maxAttempts} batch attempt(s).`);
}

if (require.main === module) {
  if (process.argv.includes('--dry-run')) {
    const draft = getNextCanvaDraft();
    if (!draft) {
      log('✅ Canva Execute Agent dry run passed. No draft is currently awaiting Canva design.');
      process.exit(0);
    }
    log(`✅ Canva Execute Agent dry run passed. Next draft: ${draft.restaurantName}`);
    process.exit(0);
  }

  const maxArg = process.argv.find((arg) => arg.startsWith('--max-attempts='));
  const maxAttempts = maxArg ? Number(maxArg.split('=')[1]) : undefined;

  executeCanvaForNextDraft({ maxAttempts })
    .then((result) => log(`✅ Canva Execute Agent complete: ${result.designUrl}`))
    .catch((error) => {
      console.error(error.message || error);
      process.exit(1);
    });
}

module.exports = { executeCanvaForNextDraft, buildStrictPrompt, getNextCanvaDraft, hasHardDisqualifier, textQualityScore };
