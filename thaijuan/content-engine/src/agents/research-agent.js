#!/usr/bin/env node

/**
 * Research Agent
 * Finds Melbourne restaurant candidates.
 *
 * Production path:
 * - Uses Google Places Text Search when GOOGLE_PLACES_API_KEY is available.
 *
 * Offline/dev path:
 * - Uses curated seed candidates so the workflow can be tested without API keys.
 */

const path = require('path');
const { loadDotEnv } = require('../lib/env');
const { DATA_DIR, readJson, writeJson, slugify } = require('../lib/files');
const { log } = require('../lib/log');

loadDotEnv();

const RESTAURANTS_PATH = path.join(DATA_DIR, 'restaurants.json');

const SEED_CANDIDATES = [
  {
    name: 'Embla',
    suburb: 'Melbourne CBD',
    address: '122 Russell St, Melbourne VIC',
    cuisine: 'Modern Australian wine bar',
    googleMapsUrl: 'https://maps.google.com/?q=Embla+Melbourne',
    rating: 4.5,
    reviewCount: 1200,
    priceLevel: '$$$',
    sources: ['seed'],
    signals: { newOpening: false, recentBuzz: true, highSavePotential: true },
    notes: 'Strong date-night and wine-bar angle; very Melbourne.'
  },
  {
    name: 'Aru',
    suburb: 'Melbourne CBD',
    address: '268 Little Collins St, Melbourne VIC',
    cuisine: 'Southeast Asian contemporary',
    googleMapsUrl: 'https://maps.google.com/?q=Aru+Melbourne',
    rating: 4.6,
    reviewCount: 900,
    priceLevel: '$$$',
    sources: ['seed'],
    signals: { newOpening: false, recentBuzz: true, highSavePotential: true },
    notes: 'Great visual/story angle around fire, smoke, and modern Southeast Asian food.'
  },
  {
    name: 'Rumi',
    suburb: 'Brunswick East',
    address: '2 Lygon St, Brunswick East VIC',
    cuisine: 'Middle Eastern',
    googleMapsUrl: 'https://maps.google.com/?q=Rumi+Brunswick+East',
    rating: 4.5,
    reviewCount: 1100,
    priceLevel: '$$',
    sources: ['seed'],
    signals: { newOpening: false, recentBuzz: false, highSavePotential: true },
    notes: 'Neighbourhood institution; good for group dinner recommendations.'
  }
];

function normalizeCandidate(candidate) {
  const id = candidate.googlePlaceId || slugify(`${candidate.name}-${candidate.suburb}`);
  return {
    id,
    name: candidate.name,
    suburb: candidate.suburb || 'Melbourne',
    address: candidate.address || '',
    cuisine: candidate.cuisine || 'Restaurant',
    googlePlaceId: candidate.googlePlaceId || null,
    googleMapsUrl: candidate.googleMapsUrl || '',
    rating: Number(candidate.rating || 0),
    reviewCount: Number(candidate.reviewCount || 0),
    priceLevel: candidate.priceLevel || '',
    sources: candidate.sources || [],
    signals: {
      newOpening: Boolean(candidate.signals?.newOpening),
      recentBuzz: Boolean(candidate.signals?.recentBuzz),
      highSavePotential: Boolean(candidate.signals?.highSavePotential)
    },
    notes: candidate.notes || '',
    discoveredAt: new Date().toISOString(),
    lastPostedAt: candidate.lastPostedAt || null
  };
}

function suburbFromFormattedAddress(formattedAddress) {
  const parts = String(formattedAddress || '').split(',').map((part) => part.trim()).filter(Boolean);
  const suburbPart = parts[1] || parts[0] || 'Melbourne';
  return suburbPart.replace(/\s+VIC\s*\d*.*/i, '').trim() || 'Melbourne';
}

async function discoverWithGooglePlaces(query = 'best new restaurants in Melbourne') {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('region', 'au');
  url.searchParams.set('key', key);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Places error: ${response.status}`);
  const data = await response.json();
  if (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status)) {
    throw new Error(`Google Places status: ${data.status} ${data.error_message || ''}`.trim());
  }

  return (data.results || []).slice(0, 10).map((place) => normalizeCandidate({
    name: place.name,
    suburb: suburbFromFormattedAddress(place.formatted_address),
    address: place.formatted_address || '',
    cuisine: 'Restaurant',
    googlePlaceId: place.place_id,
    googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
    rating: place.rating,
    reviewCount: place.user_ratings_total,
    priceLevel: place.price_level ? '$'.repeat(place.price_level) : '',
    sources: ['google_places'],
    signals: {
      newOpening: false,
      recentBuzz: Number(place.user_ratings_total || 0) > 200,
      highSavePotential: Number(place.rating || 0) >= 4.4
    },
    notes: 'Discovered from Google Places text search.'
  }));
}

function mergeCandidates(existing, incoming) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const candidate of incoming) {
    const previous = byId.get(candidate.id) || {};
    byId.set(candidate.id, { ...previous, ...candidate, lastPostedAt: previous.lastPostedAt || candidate.lastPostedAt || null });
  }
  return Array.from(byId.values());
}

async function discoverRestaurants(options = {}) {
  const existing = readJson(RESTAURANTS_PATH, []);
  let candidates = [];

  try {
    candidates = await discoverWithGooglePlaces(options.query);
  } catch (error) {
    log(`⚠️ Google Places discovery failed: ${error.message}`);
  }

  if (candidates.length === 0) {
    candidates = SEED_CANDIDATES.map(normalizeCandidate);
  }

  const merged = mergeCandidates(existing, candidates);
  writeJson(RESTAURANTS_PATH, merged);

  return { candidates, allRestaurants: merged, path: RESTAURANTS_PATH };
}

if (require.main === module) {
  discoverRestaurants()
    .then(({ candidates, path: outPath }) => {
      log(`✅ Research Agent found ${candidates.length} candidate(s). Saved to ${outPath}`);
      candidates.forEach((item, index) => log(`${index + 1}. ${item.name} — ${item.suburb}`));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { discoverRestaurants, normalizeCandidate };
