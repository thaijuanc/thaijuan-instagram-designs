#!/usr/bin/env node

/**
 * DESIGN.md Agent
 *
 * Creates a restaurant-specific DESIGN.md-style brief from enriched restaurant
 * data, website signals, Google Places, official images, and content strategy.
 */

const fs = require('fs');
const path = require('path');
const { DATA_DIR, readJson, writeJson, ensureDir, slugify } = require('../lib/files');
const { log } = require('../lib/log');

const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');
const RESTAURANTS_PATH = path.join(DATA_DIR, 'restaurants.json');
const DESIGN_MD_DIR = path.join(DATA_DIR, 'design-md');

function inferPalette(restaurant) {
  const summary = `${restaurant.officialSummary || ''} ${restaurant.name || ''}`.toLowerCase();

  // Sensible defaults for premium Melbourne restaurant editorial.
  const palette = {
    primary: '#17130F',
    secondary: '#6B4E3D',
    tertiary: '#B8422E',
    neutral: '#F7F1E8',
    surface: '#FFF8EF',
    accent: '#D8A24A',
    onPrimary: '#FFFFFF',
    onNeutral: '#17130F'
  };

  if (/asian|yum cha|bao|dumpling|peking|cocktail|cha ching/.test(summary)) {
    return {
      ...palette,
      primary: '#15110D',
      secondary: '#5E3B2E',
      tertiary: '#C43D2D',
      neutral: '#F6E7D2',
      accent: '#D6A84F'
    };
  }

  return palette;
}

function buildDesignMd({ draft, restaurant }) {
  const design = draft.contentPackage?.design || {};
  const facts = draft.contentPackage?.restaurantFacts || {};
  const visual = draft.contentPackage?.visualDirection || {};
  const palette = inferPalette(restaurant || facts);
  const name = `${draft.restaurantName} Instagram Recommendation`;

  const imageUrls = visual.imageUrls || restaurant?.officialImageUrls || [];
  const angles = facts.recommendationAngles || restaurant?.recommendationAngles || [];

  return `---
version: alpha
name: ${JSON.stringify(name)}
description: ${JSON.stringify(`Restaurant-specific visual identity brief for ${draft.restaurantName}`)}
colors:
  primary: "${palette.primary}"
  secondary: "${palette.secondary}"
  tertiary: "${palette.tertiary}"
  neutral: "${palette.neutral}"
  surface: "${palette.surface}"
  accent: "${palette.accent}"
  on-primary: "${palette.onPrimary}"
  on-neutral: "${palette.onNeutral}"
typography:
  hero:
    fontFamily: "Bold editorial sans-serif"
    fontSize: "72px"
    fontWeight: 800
    lineHeight: "0.95"
    letterSpacing: "-0.04em"
  hook:
    fontFamily: "Clean geometric sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "1.05"
  body:
    fontFamily: "Clean sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: "1.25"
  label-caps:
    fontFamily: "Condensed sans-serif"
    fontSize: "18px"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  sm: 8px
  md: 18px
  lg: 32px
spacing:
  sm: 12px
  md: 24px
  lg: 40px
components:
  cta-pill:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: 18px
  editorial-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-neutral}"
    rounded: "{rounded.md}"
    padding: 28px
---

## Overview

Create a fresh Canva Instagram portrait design for **${draft.restaurantName}**. The design should feel like a premium Melbourne food recommendation, not a generic restaurant ad.

The core story: **${design.subtitle || draft.description}**

Primary viewer takeaway within 2 seconds: **${design.headline || draft.headline} — ${design.subtitle || draft.description}**.

## Colors

Use a warm, appetite-driven palette inspired by Asian-fusion dining, cocktails, dumplings, timber interiors, night-out energy, and Melbourne CBD hospitality.

- **Primary (${palette.primary})**: deep espresso/ink for strong editorial contrast.
- **Tertiary (${palette.tertiary})**: warm red accent for CTA, energy, and appetite appeal.
- **Neutral (${palette.neutral})**: warm paper/cream background for premium editorial softness.
- **Accent (${palette.accent})**: muted gold for small highlights, dividers, or badges.

Avoid sterile white-on-stock-photo layouts. Avoid random bright colors that do not match the restaurant mood.

## Typography

Use bold, mobile-readable typography. The restaurant name must be immediately legible.

Recommended hierarchy:

1. Eyebrow: ${design.eyebrow || 'MELBOURNE RESTAURANT PICK'}
2. Hero: ${design.headline || draft.headline}
3. Hook: ${design.subtitle || draft.description}
4. Support: ${(design.bullets || []).join(' / ')}
5. CTA: ${design.cta || draft.cta}

Short social copy is preferred over dense text. If space is tight, preserve hero, hook, and CTA first.

## Layout

Instagram portrait, 1080x1350.

Recommended structure:

- Large official food/venue image as the emotional anchor.
- Editorial text panel or overlay with high contrast.
- Hero restaurant name in the upper or central third.
- Hook near the hero name.
- CTA in a clear pill or badge.
- Keep enough safe margins for mobile crop.

Do not split the restaurant name awkwardly unless it still reads instantly as “${draft.restaurantName}”.

## Elevation & Depth

Use soft editorial layering: warm card surfaces, subtle shadows, image masks, or magazine-style collage. Avoid fake app UI, overdone mockups, or decorative elements that distract from the food and hook.

## Shapes

Use rounded editorial cards and pill CTAs sparingly. The shapes should feel premium and intentional, not template-like.

## Components

### Hero image

Use official restaurant imagery where available. Uploaded Canva asset IDs should be treated as preferred imagery.

Official image URLs for reference:
${imageUrls.map((url) => `- ${url}`).join('\n') || '- None available'}

### CTA pill

Preferred CTA: **${design.cta || draft.cta}**

Make it visible. It can be shortened to “Save this” if space is limited, but the design should still feel save-worthy.

### Restaurant context

Facts and angles:
${angles.map((angle) => `- ${angle}`).join('\n') || '- Use content package restaurant facts.'}

Known details:
- Address: ${facts.address || restaurant?.address || ''}
- Website: ${facts.website || restaurant?.website || ''}
- Google rating: ${facts.rating || restaurant?.rating || ''}${facts.reviewCount || restaurant?.reviewCount ? ` from ${(facts.reviewCount || restaurant?.reviewCount).toLocaleString()} reviews` : ''}

## Do's and Don'ts

### Do

- Make the design feel specifically like ${draft.restaurantName}.
- Use the official food/venue imagery as the main visual anchor.
- Make ${design.headline || draft.headline} the clearest text.
- Communicate the hook: ${design.subtitle || draft.description}.
- Include a visible save/share CTA.
- Keep it readable on a phone at small size.

### Don't

- Do not use placeholder handles like @reallygreatsite.
- Do not invent claims like “best”, “#1”, “award-winning”, or “must-visit”.
- Do not make it feel like generic stock food content.
- Do not bury the restaurant name.
- Do not overfill the design with caption-length text.
`;
}

function generateDesignMdForDraft(draftId) {
  const drafts = readJson(DRAFTS_PATH, []);
  const restaurants = readJson(RESTAURANTS_PATH, []);
  const draft = draftId ? drafts.find((item) => item.id === draftId) : drafts[0];
  if (!draft) throw new Error('No draft found for DESIGN.md generation.');
  const restaurant = restaurants.find((item) => item.id === draft.restaurantId || item.name === draft.restaurantName) || {};

  const content = buildDesignMd({ draft, restaurant });
  ensureDir(DESIGN_MD_DIR);
  const outPath = path.join(DESIGN_MD_DIR, `${draft.id || slugify(draft.restaurantName)}.DESIGN.md`);
  fs.writeFileSync(outPath, content);

  const updatedDrafts = drafts.map((item) => item.id !== draft.id ? item : {
    ...item,
    designMdPath: outPath,
    updatedAt: new Date().toISOString()
  });
  writeJson(DRAFTS_PATH, updatedDrafts);

  return { draftId: draft.id, path: outPath, content };
}

if (require.main === module) {
  const draftArg = process.argv.find((arg) => arg.startsWith('--draft-id='));
  const draftId = draftArg ? draftArg.split('=')[1] : undefined;
  try {
    const result = generateDesignMdForDraft(draftId);
    log(`✅ DESIGN.md generated: ${result.path}`);
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { generateDesignMdForDraft, buildDesignMd };
