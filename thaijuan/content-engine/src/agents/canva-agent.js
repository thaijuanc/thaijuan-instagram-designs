#!/usr/bin/env node

/**
 * Canva Agent
 * Creates a Canva MCP design brief from a complete content package.
 * This does not use Autofill API.
 */

const path = require('path');
const { DATA_DIR, readJson, writeJson, slugify } = require('../lib/files');
const { log } = require('../lib/log');
const { generateDesignMdForDraft } = require('./design-md-agent');
const { optimizeCanvaPrompt } = require('./canva-prompt-agent');

const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');
const BRIEFS_DIR = path.join(DATA_DIR, 'canva-briefs');

function buildCanvaPrompt(draft) {
  const pkg = draft.contentPackage || {};
  const design = pkg.design || {};
  const facts = pkg.restaurantFacts || {};
  const visual = pkg.visualDirection || {};

  return `Create a fresh Canva Instagram portrait design for a Melbourne restaurant recommendation.

Hard rules:
- Use Canva.
- Do not use Autofill API.
- Create a fresh design, not a generic template fill.
- Export as PNG at 1080x1350.
- Use actual restaurant visual assets if asset_ids are provided.
- Note: images are not embedded in this text prompt. The Canva Execute Agent uploads official image URLs first and passes the resulting Canva asset IDs to generate-design.
- Do not use placeholder handles like @reallygreatsite.
- Do not invent quotes, prices, ratings, awards, menu items, or unsupported claims.
- Avoid generic stock-food imagery when official images/assets are available.

Design copy:
- Eyebrow: ${design.eyebrow || 'MELBOURNE RESTAURANT PICK'}
- Headline: ${design.headline || draft.restaurantName}
- Subtitle: ${design.subtitle || draft.description || ''}
- Bullets: ${(design.bullets || []).join(' | ')}
- CTA: ${design.cta || draft.cta}

Restaurant facts:
- Name: ${facts.name || draft.restaurantName}
- Suburb: ${facts.suburb || draft.suburb}
- Address: ${facts.address || ''}
- Cuisine: ${facts.cuisine || draft.cuisine}
- Rating: ${facts.rating || ''}${facts.reviewCount ? ` from ${facts.reviewCount} reviews` : ''}
- Website: ${facts.website || ''}
- Recommendation angles: ${(facts.recommendationAngles || []).join(' | ')}

Visual direction:
- ${visual.notes || 'Use a premium Melbourne food editorial look.'}
- If restaurant assets are available, make the design feel specifically like this venue: Asian fusion, yum cha energy, cocktails, polished CBD dinner vibe.
- Strong mobile readability.
- Restaurant name should be the clearest visual element.
- Layout should motivate someone to save/share and actually go there.
- Tasteful palette: warm neutrals, deep charcoal, cream, red/gold accent if useful.

Caption context, for tone only:
${draft.fullCaption || draft.caption || ''}

Restaurant DESIGN.md brief:
${draft.designMdContent || 'No DESIGN.md brief provided.'}

Return an editable Canva design that is ready to export as PNG.`;
}

async function createCanvaBrief(draft) {
  if (!draft) throw new Error('No draft supplied to Canva Agent.');

  let designMd = null;
  try {
    designMd = generateDesignMdForDraft(draft.id);
  } catch (error) {
    log(`⚠️ Could not generate DESIGN.md for ${draft.restaurantName}: ${error.message}`);
  }

  const draftWithDesignMd = {
    ...draft,
    designMdPath: designMd?.path || draft.designMdPath || null,
    designMdContent: designMd?.content || null
  };

  const optimizedPrompt = await optimizeCanvaPrompt(draftWithDesignMd);

  const brief = {
    id: draftWithDesignMd.id,
    status: 'ready_for_canva_mcp',
    createdAt: new Date().toISOString(),
    restaurantName: draftWithDesignMd.restaurantName,
    designMdPath: draftWithDesignMd.designMdPath,
    designMdContent: draftWithDesignMd.designMdContent,
    payload: {
      restaurantName: draftWithDesignMd.restaurantName,
      suburb: draftWithDesignMd.suburb,
      cuisine: draftWithDesignMd.cuisine,
      headline: draftWithDesignMd.headline,
      description: draftWithDesignMd.description,
      hook: draftWithDesignMd.hook,
      whyGo: draftWithDesignMd.whyGo,
      bestFor: draftWithDesignMd.bestFor,
      cta: draftWithDesignMd.cta,
      caption: draftWithDesignMd.caption,
      fullCaption: draftWithDesignMd.fullCaption,
      hashtags: draftWithDesignMd.hashtags,
      contentPackage: draftWithDesignMd.contentPackage
    },
    assetUrls: draftWithDesignMd.contentPackage?.visualDirection?.imageUrls || [],
    rawPrompt: buildCanvaPrompt(draftWithDesignMd),
    prompt: optimizedPrompt.prompt,
    promptMeta: {
      method: optimizedPrompt.method,
      model: optimizedPrompt.model,
      generatedAt: new Date().toISOString()
    },
    expectedOutput: {
      canvaDesignUrl: '',
      exportedAssetPath: '',
      notes: '',
      approvalStatus: 'ready_for_review'
    }
  };

  const briefPath = path.join(BRIEFS_DIR, `${draftWithDesignMd.id || slugify(draftWithDesignMd.restaurantName)}.json`);
  writeJson(briefPath, brief);
  return { brief, path: briefPath };
}

async function createBriefForNextDraft() {
  const drafts = readJson(DRAFTS_PATH, []);
  const draft = drafts.find((item) => item.canva?.status === 'brief_required' || item.approvalStatus === 'draft');
  if (!draft) throw new Error('No draft found that needs a Canva brief.');

  const result = await createCanvaBrief(draft);

  const updatedDrafts = drafts.map((item) => {
    if (item.id !== draft.id) return item;
    return {
      ...item,
      designMdPath: result.brief.designMdPath || item.designMdPath || null,
      canva: {
        ...item.canva,
        status: 'ready_for_canva_mcp',
        briefPath: result.path
      },
      approvalStatus: 'awaiting_canva_design'
    };
  });
  writeJson(DRAFTS_PATH, updatedDrafts);

  return result;
}

if (require.main === module) {
  (async () => {
  try {
    const { brief, path: outPath } = await createBriefForNextDraft();
    log(`✅ Canva Agent created MCP brief for ${brief.restaurantName}. Saved to ${outPath}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
  })();
}

module.exports = { createCanvaBrief, createBriefForNextDraft, buildCanvaPrompt };
