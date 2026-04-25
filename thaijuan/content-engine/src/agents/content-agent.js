#!/usr/bin/env node

/**
 * Content Agent
 * Creates a complete Instagram content package from a scored/enriched restaurant.
 */

const path = require('path');
const { DATA_DIR, readJson, writeJson, appendJsonArray, slugify, todayMelbourne } = require('../lib/files');
const { log } = require('../lib/log');

const SCORED_PATH = path.join(DATA_DIR, 'scored-restaurants.json');
const DRAFTS_PATH = path.join(DATA_DIR, 'content-drafts.json');

function pickFormat(restaurant) {
  const angles = `${restaurant.recommendationAngles?.join(' ') || ''} ${restaurant.officialSummary || ''}`.toLowerCase();
  if (/new opening/.test(angles) || restaurant.signals?.newOpening) return 'new_opening';
  if (/bottomless|affordable|cheap/.test(angles) || restaurant.priceLevel === '$' || restaurant.priceLevel === '$$') return 'cheap_eats';
  if (/cocktail|wine|date/.test(angles)) return 'date_night';
  if (/yum cha|dumpling|bao|share plates|banquet/.test(angles)) return 'group_dinner';
  return 'daily_pick';
}

function primaryAngle(restaurant) {
  return restaurant.recommendationAngles?.[0]
    || restaurant.notes
    || `A strong ${restaurant.cuisine || 'restaurant'} pick in ${restaurant.suburb}.`;
}

function inferCuisine(restaurant) {
  const text = `${restaurant.cuisine || ''} ${restaurant.officialSummary || ''}`.toLowerCase();
  if (/asian fusion|asian inspired|yum cha|bao|dumpling|peking duck/.test(text)) return 'Asian fusion';
  if (/wine|cocktail/.test(text)) return 'Restaurant & cocktails';
  return restaurant.cuisine && restaurant.cuisine !== 'Restaurant' ? restaurant.cuisine : 'Restaurant';
}

function createDesignCopy(restaurant, format) {
  const name = restaurant.name;
  const suburb = restaurant.suburb || 'Melbourne';
  const angle = primaryAngle(restaurant);

  const headline = name.toUpperCase();
  const eyebrow = format === 'date_night' ? 'MELBOURNE DATE NIGHT PICK'
    : format === 'group_dinner' ? 'MELBOURNE GROUP DINNER PICK'
    : format === 'cheap_eats' ? 'MELBOURNE VALUE PICK'
    : 'MELBOURNE RESTAURANT PICK';

  const subtitle = /yum cha|dumpling|bao/i.test(angle)
    ? 'Yum cha, cocktails and Asian-fusion share plates in the CBD.'
    : /cocktail/i.test(angle)
      ? 'Cocktails, dinner plans and polished CBD energy.'
      : angle;

  const bullets = [];
  if (/yum cha|dumpling|bao/i.test(`${angle} ${restaurant.officialSummary || ''}`)) bullets.push('Go for yum cha energy, bao and dumplings');
  if (/cocktail|drinks|bottomless/i.test(`${angle} ${restaurant.officialSummary || ''}`)) bullets.push('Stay for cocktails and a fun night-out vibe');
  if (/book|small|cozy/i.test(`${angle} ${restaurant.reviewHighlights?.map(r => r.text).join(' ') || ''}`)) bullets.push('Book ahead — it gets busy');
  if (restaurant.rating && restaurant.reviewCount) bullets.push(`${restaurant.rating}★ from ${restaurant.reviewCount.toLocaleString()} Google reviews`);

  return {
    eyebrow,
    headline,
    subtitle: subtitle.slice(0, 110),
    bullets: bullets.slice(0, 3),
    cta: 'Save this for your next Melbourne food night'
  };
}

function hashtagSet(restaurant, format) {
  const suburbTag = `#${String(restaurant.suburb || 'melbourne').toLowerCase().replace(/[^a-z0-9]/g, '')}eats`;
  const cuisine = inferCuisine(restaurant).toLowerCase();
  const cuisineTags = [];
  if (/asian/.test(cuisine)) cuisineTags.push('#asianfusion', '#melbourneasianfood');
  if (/cocktail/.test(cuisine) || format === 'date_night') cuisineTags.push('#melbournebars', '#melbournedatenight');
  if (format === 'group_dinner') cuisineTags.push('#melbournedinner', '#yumcha');

  return Array.from(new Set([
    '#melbournefood',
    '#melbournerestaurants',
    '#melbourneeats',
    suburbTag,
    ...cuisineTags,
    '#visitmelbourne',
    '#melbournefoodie'
  ])).slice(0, 10);
}

function createCaption(restaurant, designCopy, format) {
  const maps = restaurant.googleMapsUrl ? `\n\n📍 ${restaurant.googleMapsUrl}` : '';
  const bestBits = designCopy.bullets.length ? `\n\nWhy go:\n${designCopy.bullets.map((b) => `• ${b}`).join('\n')}` : '';

  const firstLine = format === 'group_dinner'
    ? `Save ${restaurant.name} for your next group dinner in ${restaurant.suburb}.`
    : format === 'date_night'
      ? `Save ${restaurant.name} for your next Melbourne date night.`
      : `Save ${restaurant.name} for your next Melbourne food plan.`;

  return `${firstLine}\n\n${designCopy.subtitle}${bestBits}\n\n${designCopy.cta}.${maps}`;
}

function createContentDraft(restaurant, options = {}) {
  if (!restaurant) throw new Error('No restaurant supplied to Content Agent.');

  const date = options.date || todayMelbourne();
  const format = pickFormat(restaurant);
  const cuisine = inferCuisine(restaurant);
  const designCopy = createDesignCopy({ ...restaurant, cuisine }, format);
  const hashtags = hashtagSet({ ...restaurant, cuisine }, format);
  const draftId = `${date}-${slugify(restaurant.name)}`;

  const contentPackage = {
    design: designCopy,
    caption: {
      hook: createCaption(restaurant, designCopy, format).split('\n')[0],
      body: createCaption(restaurant, designCopy, format),
      hashtags,
      fullCaption: `${createCaption(restaurant, designCopy, format)}\n\n${hashtags.join(' ')}`
    },
    restaurantFacts: {
      name: restaurant.name,
      suburb: restaurant.suburb,
      address: restaurant.address,
      cuisine,
      rating: restaurant.rating,
      reviewCount: restaurant.reviewCount,
      website: restaurant.website,
      googleMapsUrl: restaurant.googleMapsUrl,
      recommendationAngles: restaurant.recommendationAngles || [],
      reviewHighlights: restaurant.reviewHighlights || []
    },
    visualDirection: {
      useActualRestaurantAssets: true,
      imageUrls: restaurant.officialImageUrls || [],
      notes: 'Use official restaurant/food imagery when available. Avoid generic stock food imagery.'
    },
    story: {
      frame1: `${restaurant.name} — ${restaurant.suburb}`,
      frame2: designCopy.subtitle,
      frame3: designCopy.cta
    }
  };

  return {
    id: draftId,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    suburb: restaurant.suburb,
    cuisine,
    date,
    suggestedTime: options.suggestedTime || '18:00',
    format,
    headline: designCopy.headline,
    description: designCopy.subtitle,
    hook: contentPackage.caption.hook,
    whyGo: primaryAngle(restaurant),
    bestFor: format === 'date_night' ? 'Date night or a polished dinner plan'
      : format === 'group_dinner' ? 'Group dinner, share plates, and cocktails'
      : 'Saving for your next Melbourne food plan',
    cta: designCopy.cta,
    caption: contentPackage.caption.body,
    fullCaption: contentPackage.caption.fullCaption,
    hashtags,
    altText: `Instagram design recommending ${restaurant.name}, a ${cuisine} restaurant in ${restaurant.suburb}.`,
    contentPackage,
    canva: {
      status: 'brief_required',
      designUrl: null,
      exportedAssetPath: null
    },
    approvalStatus: 'draft',
    createdAt: new Date().toISOString()
  };
}

function createNextDraft(restaurants = readJson(SCORED_PATH, [])) {
  const existingDrafts = readJson(DRAFTS_PATH, []);
  const existingRestaurantIds = new Set(existingDrafts.map((draft) => draft.restaurantId));
  const candidate = restaurants.find((restaurant) => !restaurant.riskFlags?.includes('recently_posted') && !existingRestaurantIds.has(restaurant.id));

  if (!candidate) throw new Error('No eligible restaurant found for new draft.');

  const draft = createContentDraft(candidate);
  appendJsonArray(DRAFTS_PATH, draft);
  return { draft, path: DRAFTS_PATH };
}

if (require.main === module) {
  try {
    const { draft, path: outPath } = createNextDraft();
    log(`✅ Content Agent created draft: ${draft.restaurantName}. Saved to ${outPath}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

module.exports = { createContentDraft, createNextDraft, createDesignCopy, hashtagSet };
