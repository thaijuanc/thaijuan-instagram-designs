#!/usr/bin/env node

/**
 * Visual Quality Agent
 *
 * Uses a vision-capable GPT model to review exported Canva PNGs for subjective
 * marketing/design quality. This complements the deterministic Canva text gate.
 */

const fs = require('fs');
const path = require('path');
const { DATA_DIR, readJson, writeJson } = require('../lib/files');
const { loadDotEnv } = require('../lib/env');
const { log } = require('../lib/log');

loadDotEnv();

const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');
const DEFAULT_MODEL = process.env.VISUAL_REVIEW_MODEL || 'gpt-4.1-mini';

function imageToDataUrl(imagePath) {
  const bytes = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

function buildReviewPrompt(draft) {
  const design = draft.contentPackage?.design || {};
  const facts = draft.contentPackage?.restaurantFacts || {};

  return `You are a strict Instagram growth and design quality reviewer for a Melbourne restaurant recommendation account.

Review the attached Canva-exported Instagram post image.

Return ONLY valid JSON with this shape:
{
  "passed": boolean,
  "score": number,
  "summary": string,
  "issues": string[],
  "strengths": string[],
  "recommendation": "approve" | "regenerate" | "revise_copy" | "revise_visuals"
}

Pass criteria:
- score must be 8 or higher
- mobile readability is strong
- the restaurant name is clear
- the hook/reason to go is clear within 2 seconds
- concise social designs are allowed; do not require every bullet point if the main hook and CTA are clear
- it feels restaurant-specific, not generic stock content
- it motivates someone to save/share or visit
- visual hierarchy is strong
- no obvious placeholder text
- no unsupported hype claims like best/must-visit/#1

Expected content:
- Restaurant: ${draft.restaurantName}
- Suburb: ${draft.suburb}
- Cuisine: ${draft.cuisine}
- Headline: ${design.headline || draft.headline}
- Hook/description: ${design.subtitle || draft.description}
- Bullets/reasons: ${(design.bullets || []).join(' | ')}
- CTA: ${design.cta || draft.cta}
- Known facts: rating ${facts.rating || 'unknown'}, reviews ${facts.reviewCount || 'unknown'}, angles ${(facts.recommendationAngles || []).join(' | ')}

Be direct. If the design is pretty but generic, fail it. If it is clean, mobile-readable, has the restaurant name, a clear food/drink hook, and a visible save CTA, it can pass even if it does not include every planned bullet.`;
}

function parseJsonResponse(text) {
  const trimmed = String(text || '').trim();
  try { return JSON.parse(trimmed); } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Vision review did not return JSON: ${trimmed.slice(0, 300)}`);
  return JSON.parse(match[0]);
}

async function callOpenAiVision({ imagePath, draft, model = DEFAULT_MODEL }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing; cannot run GPT visual review.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildReviewPrompt(draft) },
            { type: 'image_url', image_url: { url: imageToDataUrl(imagePath) } }
          ]
        }
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI visual review failed: ${response.status} ${JSON.stringify(data).slice(0, 500)}`);
  }

  const text = data.choices?.[0]?.message?.content;
  const review = parseJsonResponse(text);
  return {
    passed: Boolean(review.passed) && Number(review.score) >= 8,
    score: Number(review.score || 0),
    summary: review.summary || '',
    issues: Array.isArray(review.issues) ? review.issues : [],
    strengths: Array.isArray(review.strengths) ? review.strengths : [],
    recommendation: review.recommendation || (review.passed ? 'approve' : 'regenerate'),
    model,
    checkedAt: new Date().toISOString()
  };
}

async function reviewVisualQuality({ imagePath, draft, provider = 'openai' }) {
  if (!fs.existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);
  if (!draft) throw new Error('Missing draft for visual quality review.');

  if (provider !== 'openai') {
    throw new Error(`Unsupported visual review provider: ${provider}. Currently wired: openai.`);
  }

  return callOpenAiVision({ imagePath, draft });
}

async function reviewDraftVisual(draftId) {
  const drafts = readJson(DRAFTS_PATH, []);
  const draft = draftId ? drafts.find((item) => item.id === draftId) : drafts[0];
  if (!draft) throw new Error('No draft found for visual review.');
  const assetPath = draft.canva?.exportedAssetPath;
  if (!assetPath) throw new Error(`Draft has no exported asset path: ${draft.id}`);
  const absolutePath = path.resolve(process.cwd(), assetPath);
  const review = await reviewVisualQuality({ imagePath: absolutePath, draft });

  const updatedDrafts = drafts.map((item) => item.id === draft.id
    ? {
        ...item,
        canva: {
          ...item.canva,
          visualQualityGate: review,
          updatedAt: new Date().toISOString()
        },
        approvalStatus: review.passed ? item.approvalStatus : 'needs_design_revision'
      }
    : item);
  writeJson(DRAFTS_PATH, updatedDrafts);
  return review;
}

if (require.main === module) {
  const draftArg = process.argv.find((arg) => arg.startsWith('--draft-id='));
  const imageArg = process.argv.find((arg) => arg.startsWith('--image='));
  const draftId = draftArg ? draftArg.split('=')[1] : undefined;

  (async () => {
    try {
      let review;
      if (imageArg) {
        const drafts = readJson(DRAFTS_PATH, []);
        const draft = draftId ? drafts.find((item) => item.id === draftId) : drafts[0];
        review = await reviewVisualQuality({ imagePath: imageArg.split('=')[1], draft });
      } else {
        review = await reviewDraftVisual(draftId);
      }

      if (!review.passed) {
        console.error(`❌ Visual quality gate failed (${review.score}/10): ${review.summary}`);
        if (review.issues?.length) console.error(`Issues:\n- ${review.issues.join('\n- ')}`);
        process.exit(1);
      }

      log(`✅ Visual quality gate passed (${review.score}/10): ${review.summary}`);
    } catch (error) {
      console.error(error.message || error);
      process.exit(1);
    }
  })();
}

module.exports = { reviewVisualQuality, reviewDraftVisual, buildReviewPrompt };
