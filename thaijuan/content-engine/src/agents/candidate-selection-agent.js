#!/usr/bin/env node

/**
 * Candidate Selection Agent
 *
 * Reviews multiple exported Canva candidates together and picks the best one.
 * This is more useful than a single absolute GPT visual gate because Canva
 * generates 4 candidates by default.
 */

const fs = require('fs');
const path = require('path');
const { DATA_DIR, readJson } = require('../lib/files');
const { loadDotEnv } = require('../lib/env');

loadDotEnv();

const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');
const DEFAULT_MODEL = process.env.CANDIDATE_SELECTION_MODEL || process.env.VISUAL_REVIEW_MODEL || 'gpt-4.1-mini';

function imageToDataUrl(imagePath) {
  const bytes = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

function buildSelectionPrompt({ draft, candidates }) {
  const design = draft.contentPackage?.design || {};
  const facts = draft.contentPackage?.restaurantFacts || {};

  return `You are selecting the best Instagram design candidate for a Melbourne restaurant recommendation account.

Canva generated ${candidates.length} designs. Compare them against the criteria and pick the best candidate.

Return ONLY valid JSON:
{
  "bestCandidateId": "",
  "bestIndex": number,
  "winnerScore": number,
  "scores": [{"candidateId":"", "index": number, "score": number, "reason":""}],
  "summary": "",
  "issues": [],
  "recommendation": "use_best" | "regenerate"
}

Criteria:
- restaurant name is readable immediately
- food/drink hook is clear quickly
- visible CTA/save motivation
- mobile readability
- visual hierarchy
- restaurant-specific look, not generic stock
- premium Melbourne food editorial feel
- no obvious placeholders
- no unsupported hype claims like best/must-visit/#1

Expected content:
- Restaurant: ${draft.restaurantName}
- Suburb: ${draft.suburb}
- Headline: ${design.headline || draft.headline}
- Hook: ${design.subtitle || draft.description}
- Reasons: ${(design.bullets || []).join(' | ')}
- CTA: ${design.cta || draft.cta}
- Angles: ${(facts.recommendationAngles || []).join(' | ')}

Important:
- Pick the best of the batch even if imperfect.
- Recommend regenerate only if every candidate is clearly unusable, e.g. missing restaurant name, placeholders, unreadable, or wrong topic.
- Be pragmatic: an 8/10 concise social design is better than a cluttered design containing every bullet.

Candidate order and IDs:
${candidates.map((candidate, index) => `${index + 1}. ${candidate.candidateId}`).join('\n')}`;
}

function parseJsonResponse(text) {
  const trimmed = String(text || '').trim();
  try { return JSON.parse(trimmed); } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Candidate selector did not return JSON: ${trimmed.slice(0, 300)}`);
  return JSON.parse(match[0]);
}

async function selectBestCandidate({ draft, candidates, model = DEFAULT_MODEL }) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing; cannot select best visual candidate.');
  if (!candidates?.length) throw new Error('No candidates supplied for selection.');

  const content = [{ type: 'text', text: buildSelectionPrompt({ draft, candidates }) }];
  for (const candidate of candidates) {
    content.push({ type: 'text', text: `Candidate ${candidate.index + 1}: ${candidate.candidateId}` });
    content.push({ type: 'image_url', image_url: { url: imageToDataUrl(candidate.outputPath) } });
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
      messages: [{ role: 'user', content }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`OpenAI candidate selection failed: ${response.status} ${JSON.stringify(data).slice(0, 500)}`);

  const result = parseJsonResponse(data.choices?.[0]?.message?.content);
  const best = candidates.find((candidate) => candidate.candidateId === result.bestCandidateId)
    || candidates[result.bestIndex - 1]
    || candidates[result.bestIndex]
    || candidates[0];

  return {
    ...result,
    bestCandidateId: best.candidateId,
    bestIndex: best.index,
    winnerScore: Number(result.winnerScore || result.scores?.find((s) => s.candidateId === best.candidateId)?.score || 0),
    selected: best,
    model,
    checkedAt: new Date().toISOString()
  };
}

if (require.main === module) {
  console.error('Use this module from canva-execute-agent.js; it expects candidate image paths.');
  process.exit(1);
}

module.exports = { selectBestCandidate, buildSelectionPrompt };
