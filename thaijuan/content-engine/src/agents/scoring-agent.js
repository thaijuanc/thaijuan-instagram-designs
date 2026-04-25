#!/usr/bin/env node

/**
 * Scoring Agent
 * Ranks restaurant candidates for Instagram growth potential.
 */

const path = require('path');
const { DATA_DIR, CONFIG_DIR, readJson, writeJson } = require('../lib/files');
const { log } = require('../lib/log');

const RESTAURANTS_PATH = path.join(DATA_DIR, 'restaurants.json');
const SCORED_PATH = path.join(DATA_DIR, 'scored-restaurants.json');
const WEIGHTS_PATH = path.join(CONFIG_DIR, 'scoring-weights.json');
const WEIGHTS_EXAMPLE_PATH = path.join(CONFIG_DIR, 'scoring-weights.example.json');

function loadWeights() {
  return readJson(WEIGHTS_PATH, readJson(WEIGHTS_EXAMPLE_PATH, {
    weights: {
      foodAppeal: 15,
      visualPotential: 15,
      locationRelevance: 10,
      novelty: 10,
      ratingStrength: 10,
      reviewVolume: 10,
      recentBuzz: 15,
      priceAccessibility: 5,
      saveSharePotential: 10
    },
    rules: {
      minimumRating: 4.2,
      minimumReviewCount: 50,
      avoidDuplicateWithinDays: 60
    }
  }));
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function daysSince(dateString) {
  if (!dateString) return Infinity;
  return (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24);
}

function scoreRestaurant(restaurant, config = loadWeights()) {
  const { weights, rules } = config;
  const riskFlags = [];

  if (restaurant.rating && restaurant.rating < rules.minimumRating) riskFlags.push('low_rating');
  if (restaurant.reviewCount && restaurant.reviewCount < rules.minimumReviewCount) riskFlags.push('low_review_count');
  if (daysSince(restaurant.lastPostedAt) < rules.avoidDuplicateWithinDays) riskFlags.push('recently_posted');

  const ratingStrength = clamp((restaurant.rating - 4.0) / 1.0);
  const reviewVolume = clamp(Math.log10((restaurant.reviewCount || 1) + 1) / 4);
  const recentBuzz = restaurant.signals?.recentBuzz ? 1 : 0.45;
  const savePotential = restaurant.signals?.highSavePotential ? 1 : 0.55;
  const novelty = restaurant.signals?.newOpening ? 1 : 0.55;
  const priceAccessibility = restaurant.priceLevel === '$' || restaurant.priceLevel === '$$' ? 1 : 0.65;

  const cuisineText = `${restaurant.cuisine || ''} ${restaurant.notes || ''}`.toLowerCase();
  const visualPotential = /wine|bar|fire|thai|japanese|korean|bakery|dessert|pizza|ramen|middle eastern|modern/.test(cuisineText) ? 1 : 0.7;
  const foodAppeal = /restaurant|bar|bakery|thai|asian|middle eastern|modern|wine/.test(cuisineText) ? 1 : 0.75;
  const locationRelevance = /melbourne|fitzroy|collingwood|carlton|brunswick|richmond|cbd|south yarra|northcote/.test(`${restaurant.suburb} ${restaurant.address}`.toLowerCase()) ? 1 : 0.7;

  const score =
    foodAppeal * weights.foodAppeal +
    visualPotential * weights.visualPotential +
    locationRelevance * weights.locationRelevance +
    novelty * weights.novelty +
    ratingStrength * weights.ratingStrength +
    reviewVolume * weights.reviewVolume +
    recentBuzz * weights.recentBuzz +
    priceAccessibility * weights.priceAccessibility +
    savePotential * weights.saveSharePotential -
    riskFlags.length * 12;

  return {
    ...restaurant,
    score: Math.round(score * 10) / 10,
    riskFlags,
    scoredAt: new Date().toISOString()
  };
}

function scoreRestaurants(restaurants = readJson(RESTAURANTS_PATH, [])) {
  const config = loadWeights();
  const scored = restaurants
    .map((restaurant) => scoreRestaurant(restaurant, config))
    .sort((a, b) => b.score - a.score);

  writeJson(SCORED_PATH, scored);
  return { scored, path: SCORED_PATH };
}

if (require.main === module) {
  const { scored, path: outPath } = scoreRestaurants();
  log(`✅ Scoring Agent ranked ${scored.length} restaurant(s). Saved to ${outPath}`);
  scored.slice(0, 5).forEach((item, index) => log(`${index + 1}. ${item.name} — ${item.score}`));
}

module.exports = { scoreRestaurants, scoreRestaurant };
