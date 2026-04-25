#!/usr/bin/env node

/**
 * Enrichment Agent
 * Adds restaurant-specific facts, review signals, official website copy, and visual assets.
 * This prevents Canva from generating generic-looking posts.
 */

const path = require('path');
const https = require('https');
const http = require('http');
const { loadDotEnv } = require('../lib/env');
const { DATA_DIR, readJson, writeJson } = require('../lib/files');
const { log } = require('../lib/log');

loadDotEnv();

const RESTAURANTS_PATH = path.join(DATA_DIR, 'restaurants.json');

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

function fetchText(url) {
  if (typeof fetch === 'function') {
    return fetch(url, { redirect: 'follow' })
      .then((response) => response.ok ? response.text() : '')
      .catch(() => '');
  }

  return new Promise((resolve) => {
    const client = String(url).startsWith('http://') ? http : https;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(new URL(res.headers.location, url).toString()));
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function cleanText(text) {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractOfficialImages(html, baseUrl) {
  const imageUrls = new Map();
  const regex = /https?:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi;
  for (const match of html.matchAll(regex)) {
    const raw = match[0].replace(/,$/, '');
    if (/plugins\/|cropped-|logo|AGFG|Timeout|Urbanlist|Restaurant-Guru|gift|ghost|pumpkin|skull|tree|moon|bat|ANZAC|Mother|Special|Bottomless|Birthday/i.test(raw)) continue;
    const canonical = raw.replace(/-\d+x\d+(?=\.(?:jpg|jpeg|png|webp))/i, '');
    if (!imageUrls.has(canonical) || /scaled\./i.test(raw)) imageUrls.set(canonical, raw);
  }

  // Keep likely restaurant/food hero images first.
  return Array.from(imageUrls.values())
    .filter((url) => new URL(url).hostname === new URL(baseUrl).hostname)
    .slice(0, 5);
}

async function fetchGooglePlaceDetails(restaurant) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !restaurant.googlePlaceId) return {};

  const fields = 'name,formatted_address,formatted_phone_number,website,url,rating,user_ratings_total,price_level,opening_hours,types,reviews';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(restaurant.googlePlaceId)}&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(key)}`;
  const response = await getJson(url);
  if (response.status !== 'OK') {
    throw new Error(`Google Place details failed: ${response.status} ${response.error_message || ''}`.trim());
  }

  const result = response.result || {};
  return {
    address: result.formatted_address || restaurant.address,
    website: result.website || restaurant.website || '',
    googleMapsUrl: result.url || restaurant.googleMapsUrl,
    rating: result.rating || restaurant.rating,
    reviewCount: result.user_ratings_total || restaurant.reviewCount,
    priceLevel: result.price_level ? '$'.repeat(result.price_level) : restaurant.priceLevel,
    types: result.types || restaurant.types || [],
    reviewHighlights: (result.reviews || [])
      .filter((review) => review.rating >= 4 && review.text)
      .slice(0, 4)
      .map((review) => ({
        rating: review.rating,
        text: review.text.replace(/\s+/g, ' ').trim().slice(0, 280),
        age: review.relative_time_description
      }))
  };
}

function deriveAngles(restaurant) {
  const text = `${restaurant.officialSummary || ''} ${restaurant.reviewHighlights?.map((r) => r.text).join(' ') || ''}`.toLowerCase();
  const angles = [];

  if (/yum cha|dumpling|bao|peking duck/.test(text)) angles.push('Yum cha energy with dumplings, bao, and Asian-fusion share plates');
  if (/cocktail|drinks|bottomless|wine/.test(text)) angles.push('Cocktails and dinner plans in the CBD');
  if (/set menu|feed me|banquet/.test(text)) angles.push('Good for groups who want the table filled without overthinking the order');
  if (/small|cozy|book/.test(text)) angles.push('Small venue energy — book ahead');
  if (/vibrancy|flavour|street food/.test(text)) angles.push('Street-food flavours with a polished city finish');

  return Array.from(new Set(angles)).slice(0, 4);
}

async function enrichRestaurant(restaurant) {
  let enriched = { ...restaurant };

  try {
    enriched = { ...enriched, ...(await fetchGooglePlaceDetails(restaurant)) };
  } catch (error) {
    log(`⚠️ Place details failed for ${restaurant.name}: ${error.message}`);
  }

  if (enriched.website) {
    const html = await fetchText(enriched.website);
    const text = cleanText(html);
    enriched.officialSummary = text.slice(0, 1200);
    enriched.officialImageUrls = extractOfficialImages(html, enriched.website);
  }

  enriched.recommendationAngles = deriveAngles(enriched);
  enriched.enrichedAt = new Date().toISOString();
  return enriched;
}

async function enrichRestaurants(restaurants = readJson(RESTAURANTS_PATH, []), options = {}) {
  const limit = options.limit || restaurants.length;
  const targetIds = new Set((options.ids || []).filter(Boolean));
  const enriched = [];

  for (const restaurant of restaurants) {
    const shouldEnrich = targetIds.size ? targetIds.has(restaurant.id) : enriched.length < limit;
    if (!shouldEnrich) {
      enriched.push(restaurant);
      continue;
    }
    enriched.push(await enrichRestaurant(restaurant));
  }

  writeJson(RESTAURANTS_PATH, enriched);
  return { restaurants: enriched, path: RESTAURANTS_PATH };
}

if (require.main === module) {
  enrichRestaurants(undefined, { limit: Number(process.env.ENRICH_LIMIT || 10) })
    .then(({ restaurants, path: outPath }) => {
      log(`✅ Enrichment Agent updated ${restaurants.length} restaurant(s). Saved to ${outPath}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { enrichRestaurants, enrichRestaurant, deriveAngles };
