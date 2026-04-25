#!/usr/bin/env node

/**
 * Canva Prompt Agent
 *
 * Converts the rich content package + restaurant DESIGN.md into a Canva-friendly
 * art-direction brief. Canva generation performs better when we give it enough
 * composition, hierarchy, mood, copy, and quality constraints to avoid generic
 * template-looking outputs.
 */

const fs = require('fs');
const path = require('path');
const { DATA_DIR, readJson, writeJson } = require('../lib/files');
const { loadDotEnv } = require('../lib/env');
const { log } = require('../lib/log');

loadDotEnv();

const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');
const PROMPTS_DIR = path.join(DATA_DIR, 'canva-prompts');
const DEFAULT_MODEL = process.env.CANVA_PROMPT_MODEL || 'gpt-4.1-mini';
const MAX_PROMPT_CHARS = Number(process.env.CANVA_PROMPT_MAX_CHARS || 4500);

function trim(value, max = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function lines(values) {
  return values.filter(Boolean).map((value) => `- ${value}`).join('\n');
}

function getColorsFromDesignMd(designMd) {
  return [...String(designMd || '').matchAll(/(primary|secondary|tertiary|neutral|surface|accent):\s+"(#[A-Fa-f0-9]{6})"/g)]
    .map((match) => `${match[1]} ${match[2]}`)
    .join(', ');
}

function deterministicPrompt(draft) {
  const design = draft.contentPackage?.design || {};
  const facts = draft.contentPackage?.restaurantFacts || {};
  const visual = draft.contentPackage?.visualDirection || {};
  const designMd = draft.designMdContent || '';
  const headline = design.headline || draft.headline || draft.restaurantName;
  const hook = design.subtitle || draft.description || '';
  const support = (design.bullets || []).filter(Boolean);
  const cta = design.cta || draft.cta || 'Save this for later';
  const colors = getColorsFromDesignMd(designMd) || 'deep espresso/ink, warm cream, muted gold, warm red accent';
  const angles = facts.recommendationAngles || [];
  const reviewHighlights = (facts.reviewHighlights || [])
    .slice(0, 3)
    .map((review) => trim(review.text, 150));

  const imageDirection = visual.imageUrls?.length
    ? 'Use the uploaded official Cha Ching restaurant images as the hero imagery. Prioritise appetising food/cocktail details and avoid generic stock food.'
    : 'Use premium appetising Asian-fusion food/cocktail imagery that feels specific to a Melbourne CBD dinner venue.';

  return `Create a fresh Canva Instagram post, portrait 1080x1350, for a Melbourne restaurant recommendation account.

PROJECT GOAL
Design one premium, save-worthy Melbourne food recommendation post for ${draft.restaurantName}. This should feel like editorial social content from a tasteful local food guide, not an ad, not a poster template, and not generic Canva stock content.

RESTAURANT CONTEXT
${lines([
  `Restaurant: ${draft.restaurantName}`,
  `Location: ${facts.address || `${draft.suburb || 'Melbourne'} CBD`}`,
  `Cuisine / vibe: ${draft.cuisine || facts.cuisine || 'Asian fusion'}; yum cha energy, cocktails, shared plates, CBD night-out mood`,
  facts.rating && facts.reviewCount ? `Public signal: ${facts.rating} rating from ${facts.reviewCount} Google reviews` : '',
  facts.website ? `Website: ${facts.website}` : '',
  angles.length ? `Why people go: ${angles.join(' / ')}` : '',
  reviewHighlights.length ? `Review texture: ${reviewHighlights.join(' / ')}` : ''
])}

PRIMARY VIEWER TAKEAWAY
Within 2 seconds, the viewer should understand: “Cha Ching is a Melbourne CBD spot for yum cha, cocktails, and group dinners — save it for later.”

USE THESE UPLOADED ASSETS
${imageDirection}
If multiple uploaded assets are available, create an editorial collage or layered crop using 1–3 images. Keep food appetising and visible. Do not cover the hero food with a giant opaque block.

EXACT VISIBLE COPY
Use short social-design copy only. Do not add long paragraph text.
Required text, in this hierarchy:
1. Eyebrow / label: ${design.eyebrow || 'MELBOURNE GROUP DINNER PICK'}
2. Main headline: ${headline}
3. Hook: ${hook}
4. Supporting reason line: ${support[0] || 'Book this for your next group dinner'}
5. Secondary support, if space allows: ${support[1] || 'Asian-fusion share plates + cocktails'}
6. CTA: ${cta}
7. Optional tiny location detail: Flinders Ln, Melbourne

LAYOUT DIRECTION
Create a clean editorial composition with strong mobile readability:
- Use a 4:5 Instagram portrait layout with generous safe margins.
- Make “${headline}” the clearest text, but keep the hook and CTA genuinely visible.
- Use one large hero food/cocktail image area plus a smaller editorial card or badge for copy.
- Add a clear CTA pill/badge near the lower third: “${cta}”.
- Keep copy grouped into 2–3 readable clusters max.
- Use depth through warm cards, subtle shadows, image masks, rounded corners, or magazine-style layering.
- Avoid a flat centered title slide. Avoid huge text blocks covering the food.
- Do not split “Cha Ching” across separate lines unless it still reads instantly as one restaurant name.

VISUAL STYLE
Premium Melbourne food editorial: warm, moody, appetising, contemporary, local-guide energy.
Palette: ${colors}.
Typography: bold editorial sans-serif for the restaurant name; clean geometric sans-serif for hook/support; condensed small-caps label for the eyebrow. Use high contrast and strong hierarchy.
Mood references: polished CBD dinner, dumplings/bao/share plates, cocktails, warm low-light restaurant energy, saveable food guide carousel cover.

QUALITY BAR
The finished design should pass these checks:
- Restaurant name readable at phone size.
- Hook “Yum cha + cocktails in the CBD” visible without zooming.
- CTA/save motivation visible.
- Looks restaurant-specific, not like a generic stock-food post.
- Feels useful as a recommendation, not a restaurant advertisement.
- No placeholder handles or fake social account names.

DO NOT INCLUDE
- No @reallygreatsite or placeholder text.
- No invented claims: best, #1, must-visit, award-winning, authentic, hidden gem.
- No generic filler such as “Melbourne’s new dining experience”.
- No long caption paragraphs inside the design.
- No fake prices, fake menu names, fake quotes, fake opening claims.
- No visible Canva selection handles, bounding boxes, or editing artefacts.
- Do not bury the CTA.

Return one polished editable Canva Instagram post candidate.`.slice(0, MAX_PROMPT_CHARS);
}

function buildOptimizerInput(draft) {
  const design = draft.contentPackage?.design || {};
  const facts = draft.contentPackage?.restaurantFacts || {};
  const visual = draft.contentPackage?.visualDirection || {};

  return {
    restaurant: {
      name: draft.restaurantName,
      suburb: draft.suburb,
      cuisine: draft.cuisine,
      address: facts.address,
      website: facts.website,
      rating: facts.rating,
      reviewCount: facts.reviewCount,
      angles: facts.recommendationAngles || [],
      reviewHighlights: (facts.reviewHighlights || []).slice(0, 4)
    },
    requiredVisibleText: {
      eyebrow: design.eyebrow,
      headline: design.headline || draft.headline || draft.restaurantName,
      hook: design.subtitle || draft.description,
      support: (design.bullets || []).slice(0, 3),
      cta: design.cta || draft.cta,
      optionalLocation: 'Flinders Ln, Melbourne'
    },
    visualDirection: {
      notes: visual.notes,
      hasOfficialAssets: Boolean(visual.imageUrls?.length),
      imageUrls: (visual.imageUrls || []).slice(0, 5),
      designMd: trim(draft.designMdContent, 3500)
    }
  };
}

async function optimizeCanvaPrompt(draft, options = {}) {
  if (!process.env.OPENAI_API_KEY || options.noLlm) {
    return {
      prompt: deterministicPrompt(draft),
      method: 'deterministic_rich',
      model: null
    };
  }

  const body = {
    model: options.model || DEFAULT_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You write rich art-direction prompts for Canva MCP generate-design. Return only JSON: {"prompt":"..."}. The prompt should be detailed enough to guide composition, hierarchy, imagery, copy, style, and quality checks while staying under the requested character limit.'
      },
      {
        role: 'user',
        content: `Create a rich Canva generation prompt under ${MAX_PROMPT_CHARS} characters from this brief. Rules: include exact visible copy hierarchy; include concrete layout/composition instructions; tell Canva to use uploaded asset images; include palette, typography, mood, and restaurant-specific facts; include negative constraints; explicitly require visible CTA/save motivation; avoid generic promo language. Brief JSON:\n${JSON.stringify(buildOptimizerInput(draft), null, 2)}\n\nA strong deterministic draft to improve/compress if useful:\n${deterministicPrompt(draft)}`
      }
    ]
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    log(`⚠️ Prompt optimization failed; falling back. ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
    return {
      prompt: deterministicPrompt(draft),
      method: 'deterministic_rich_fallback',
      model: null
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
  } catch {
    parsed = {};
  }

  const prompt = trim(parsed.prompt || deterministicPrompt(draft), MAX_PROMPT_CHARS);
  return {
    prompt,
    method: 'openai_rich',
    model: body.model
  };
}

async function generatePromptForDraft(draftId, options = {}) {
  const drafts = readJson(DRAFTS_PATH, []);
  const draft = draftId ? drafts.find((item) => item.id === draftId) : drafts[0];
  if (!draft) throw new Error('No draft found for Canva prompt generation.');

  const result = await optimizeCanvaPrompt(draft, options);
  fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  const outPath = path.join(PROMPTS_DIR, `${draft.id}.txt`);
  fs.writeFileSync(outPath, result.prompt);

  const updatedDrafts = drafts.map((item) => item.id !== draft.id ? item : {
    ...item,
    canvaOptimizedPromptPath: outPath,
    canvaOptimizedPrompt: result.prompt,
    canvaPromptMeta: {
      method: result.method,
      model: result.model,
      generatedAt: new Date().toISOString(),
      maxChars: MAX_PROMPT_CHARS
    }
  });
  writeJson(DRAFTS_PATH, updatedDrafts);

  return { draftId: draft.id, path: outPath, ...result };
}

if (require.main === module) {
  const draftArg = process.argv.find((arg) => arg.startsWith('--draft-id='));
  const noLlm = process.argv.includes('--no-llm');
  const draftId = draftArg ? draftArg.split('=')[1] : undefined;

  generatePromptForDraft(draftId, { noLlm })
    .then((result) => {
      log(`✅ Canva prompt generated: ${result.path}`);
      console.log('\n' + result.prompt);
    })
    .catch((error) => {
      console.error(error.message || error);
      process.exit(1);
    });
}

module.exports = { optimizeCanvaPrompt, generatePromptForDraft, deterministicPrompt };
