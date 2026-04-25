#!/usr/bin/env node

/**
 * Canva Edit Handoff Agent
 *
 * Canva's MCP design-edit workflow is primarily a handoff pattern: after a
 * design is created/touched, return the edit URL so a human can refine it in
 * Canva. In the currently exposed MCP toolset, direct editing transactions are
 * not available, so we add structured comments to the best candidate and store
 * the Canva edit URL on the draft.
 */

const path = require('path');
const { execFileSync } = require('child_process');
const { DATA_DIR, ROOT, readJson, writeJson } = require('../lib/files');
const { log } = require('../lib/log');

const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');

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
    maxBuffer: 1024 * 1024 * 10
  });

  const result = JSON.parse(stdout);
  if (result.isError) {
    const message = result.content?.map((item) => item.text).join('\n') || `Canva MCP ${tool} failed`;
    throw new Error(message);
  }
  return result;
}

function pickBestRejectedDesign(draft) {
  const rejected = draft.canva?.rejectedDesigns || [];
  const scored = rejected
    .filter((item) => item.designId && item.designUrl)
    .map((item) => {
      const text = String(item.designText || '').toLowerCase();
      let score = 0;
      if (text.includes('cha ching')) score += 5;
      if (text.includes('yum')) score += 2;
      if (text.includes('cocktail')) score += 2;
      if (text.includes('save')) score += 2;
      score -= (item.issues || []).length;
      if (item.gate === 'visual') score += 3; // passed text, failed visual = usually better edit base
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.item || null;
}

function buildRevisionComment(draft, rejectedDesign) {
  const design = draft.contentPackage?.design || {};
  const required = [
    design.eyebrow,
    design.headline || draft.headline,
    design.subtitle || draft.description,
    ...(design.bullets || []),
    design.cta || draft.cta
  ].filter(Boolean);

  const issues = (rejectedDesign?.issues || []).slice(0, 5);

  return [
    'Bob quality review: please revise this post before approval.',
    '',
    'Required copy to include:',
    ...required.map((line) => `• ${line}`),
    '',
    'Fix:',
    '• Make the hook obvious within 2 seconds.',
    '• Add a visible save CTA.',
    '• Make CHA CHING the clearest text.',
    '• Keep it mobile-readable and less generic.',
    ...(issues.length ? ['', 'Detected issues:', ...issues.map((issue) => `• ${issue}`)] : [])
  ].join('\n').slice(0, 1000);
}

function createEditHandoffForDraft(draftId) {
  const drafts = readJson(DRAFTS_PATH, []);
  const draft = draftId ? drafts.find((item) => item.id === draftId) : drafts[0];
  if (!draft) throw new Error('No draft found for Canva edit handoff.');

  const rejectedDesign = pickBestRejectedDesign(draft) || {
    designId: draft.canva?.designId,
    designUrl: draft.canva?.designUrl,
    issues: draft.canva?.visualQualityGate?.issues || draft.canva?.qualityGate?.issues || []
  };

  if (!rejectedDesign.designId || !rejectedDesign.designUrl) {
    throw new Error('No Canva design available for edit handoff.');
  }

  const comment = buildRevisionComment(draft, rejectedDesign);
  const commentResult = mcporterCall('comment-on-design', {
    design_id: rejectedDesign.designId,
    message_plaintext: comment,
    user_intent: 'Add revision instructions to Canva design for human edit handoff'
  });

  const updatedDrafts = drafts.map((item) => item.id !== draft.id ? item : {
    ...item,
    canva: {
      ...item.canva,
      editHandoff: {
        designId: rejectedDesign.designId,
        designUrl: rejectedDesign.designUrl,
        comment,
        commentResult,
        createdAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    },
    approvalStatus: 'needs_design_revision'
  });
  writeJson(DRAFTS_PATH, updatedDrafts);

  return {
    draftId: draft.id,
    designId: rejectedDesign.designId,
    designUrl: rejectedDesign.designUrl,
    comment
  };
}

if (require.main === module) {
  const draftArg = process.argv.find((arg) => arg.startsWith('--draft-id='));
  const draftId = draftArg ? draftArg.split('=')[1] : undefined;

  try {
    const result = createEditHandoffForDraft(draftId);
    log(`✅ Canva edit handoff ready: ${result.designUrl}`);
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { createEditHandoffForDraft, buildRevisionComment, pickBestRejectedDesign };
