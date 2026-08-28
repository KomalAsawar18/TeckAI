const mongoose = require('mongoose');
const { runControlledEezepcCanonicalSync } = require('./controlledEezepcSync');
const { runControlledInfinityCanonicalSync } = require('../ingestion/sources/infinity/controlledSync');
const CanonicalProduct = require('../models/CanonicalProduct');
const ProductOffer = require('../models/ProductOffer');
const Category = require('../models/Category');

/**
 * Discovered Category Metadata Mappings for Targeted Canonical Expansion.
 */
const SOURCE_CATEGORY_CONFIG = {
  EEZEPC: {
    laptops: ['laptops'], // Parent category ID 3566
    headphones: ['headphones', 'headsets'] // Category IDs 9159 ("Headphones") & 60 ("Headsets")
  },
  INFINITY_STORE: {
    laptops: [], // No laptop category exists on Infinity Store (0 products)
    headphones: ['headphones'] // Category ID 267 ("Headphones", 50 products)
  }
};

/**
 * Ensures standard TeckAI category documents exist in the database.
 */
async function ensureStandardCategories() {
  const catSlugs = ['laptops', 'monitors', 'keyboards', 'mouse', 'headphones'];
  const nameMap = {
    laptops: 'Laptops',
    monitors: 'Monitors',
    keyboards: 'Keyboards',
    mouse: 'Mouse',
    headphones: 'Headphones'
  };

  for (const slug of catSlugs) {
    await Category.findOneAndUpdate(
      { slug },
      { name: nameMap[slug], slug, isActive: true },
      { upsert: true, new: true }
    );
  }
}

/**
 * Runs a targeted, category-filtered synchronization across supported structured sources.
 * 
 * @param {Object} [params]
 * @param {Array<string>} [params.targetCategories=['laptops', 'headphones']]
 * @param {number} [params.maxPages=3]
 * @param {number} [params.perPage=10]
 * @param {number} [params.startPage=1]
 * @returns {Promise<{
 *   success: boolean,
 *   summary: Object,
 *   sourceResults: Object,
 *   categoryBreakdown: Object,
 *   crossSourceMatches: Array<Object>,
 *   catalogDistribution: Object,
 *   missingImages: Object
 * }>}
 */
async function runTargetedCategoryCanonicalSync({
  targetCategories = ['laptops', 'headphones'],
  maxPages = 3,
  perPage = 10,
  startPage = 1
} = {}) {
  await ensureStandardCategories();

  const safeMaxPages = Math.min(Math.max(Number(maxPages) || 3, 1), 10);
  const safePerPage = Math.min(Math.max(Number(perPage) || 10, 1), 20);
  const safeStartPage = Math.max(Number(startPage) || 1, 1);

  const sourceResults = {
    EEZEPC: {},
    INFINITY_STORE: {}
  };

  const categoryBreakdown = {};
  for (const cat of targetCategories) {
    categoryBreakdown[cat] = {
      fetched: 0,
      supported: 0,
      matchable: 0,
      insufficientIdentity: 0,
      failed: 0,
      canonicalCreated: 0,
      canonicalReused: 0,
      offersCreated: 0,
      offersUpdated: 0,
      skipped: 0
    };
  }

  // 1. Process EEZEPC Targeted Categories
  for (const targetCat of targetCategories) {
    const eezeTargets = SOURCE_CATEGORY_CONFIG.EEZEPC[targetCat] || [];
    sourceResults.EEZEPC[targetCat] = {
      fetched: 0,
      supported: 0,
      matchable: 0,
      insufficientIdentity: 0,
      failed: 0,
      canonicalCreated: 0,
      canonicalReused: 0,
      offersCreated: 0,
      offersUpdated: 0,
      skipped: 0,
      status: eezeTargets.length > 0 ? 'synced' : 'no_usable_structured_products_found'
    };

    if (eezeTargets.length === 0) {
      continue;
    }

    for (const sourceCatFilter of eezeTargets) {
      const res = await runControlledEezepcCanonicalSync({
        categoryFilter: sourceCatFilter,
        startPage: safeStartPage,
        maxPages: safeMaxPages,
        perPage: safePerPage
      });

      if (res && res.categories && res.categories[targetCat]) {
        const catStats = res.categories[targetCat];
        sourceResults.EEZEPC[targetCat].fetched += catStats.fetched;
        sourceResults.EEZEPC[targetCat].supported += catStats.supported;
        sourceResults.EEZEPC[targetCat].matchable += catStats.matchable;
        sourceResults.EEZEPC[targetCat].insufficientIdentity += catStats.insufficientIdentity;
        sourceResults.EEZEPC[targetCat].failed += catStats.failed;
        sourceResults.EEZEPC[targetCat].canonicalCreated += catStats.canonicalCreated;
        sourceResults.EEZEPC[targetCat].canonicalReused += catStats.canonicalReused;
        sourceResults.EEZEPC[targetCat].offersCreated += catStats.offersCreated;
        sourceResults.EEZEPC[targetCat].offersUpdated += catStats.offersUpdated;
        sourceResults.EEZEPC[targetCat].skipped += catStats.skipped;

        categoryBreakdown[targetCat].fetched += catStats.fetched;
        categoryBreakdown[targetCat].supported += catStats.supported;
        categoryBreakdown[targetCat].matchable += catStats.matchable;
        categoryBreakdown[targetCat].insufficientIdentity += catStats.insufficientIdentity;
        categoryBreakdown[targetCat].failed += catStats.failed;
        categoryBreakdown[targetCat].canonicalCreated += catStats.canonicalCreated;
        categoryBreakdown[targetCat].canonicalReused += catStats.canonicalReused;
        categoryBreakdown[targetCat].offersCreated += catStats.offersCreated;
        categoryBreakdown[targetCat].offersUpdated += catStats.offersUpdated;
        categoryBreakdown[targetCat].skipped += catStats.skipped;
      }
    }
  }

  // 2. Process INFINITY_STORE Targeted Categories
  for (const targetCat of targetCategories) {
    const infTargets = SOURCE_CATEGORY_CONFIG.INFINITY_STORE[targetCat] || [];
    sourceResults.INFINITY_STORE[targetCat] = {
      fetched: 0,
      supported: 0,
      matchable: 0,
      insufficientIdentity: 0,
      failed: 0,
      canonicalCreated: 0,
      canonicalReused: 0,
      offersCreated: 0,
      offersUpdated: 0,
      skipped: 0,
      status: infTargets.length > 0 ? 'synced' : 'no_usable_structured_products_found'
    };

    if (infTargets.length === 0) {
      continue;
    }

    for (const sourceCatFilter of infTargets) {
      const res = await runControlledInfinityCanonicalSync({
        categoryFilter: sourceCatFilter,
        startPage: safeStartPage,
        maxPages: safeMaxPages,
        perPage: safePerPage
      });

      if (res && res.categories && res.categories[targetCat]) {
        const catStats = res.categories[targetCat];
        sourceResults.INFINITY_STORE[targetCat].fetched += catStats.fetched;
        sourceResults.INFINITY_STORE[targetCat].supported += catStats.supported;
        sourceResults.INFINITY_STORE[targetCat].matchable += catStats.matchable;
        sourceResults.INFINITY_STORE[targetCat].insufficientIdentity += catStats.insufficientIdentity;
        sourceResults.INFINITY_STORE[targetCat].failed += catStats.failed;
        sourceResults.INFINITY_STORE[targetCat].canonicalCreated += catStats.canonicalCreated;
        sourceResults.INFINITY_STORE[targetCat].canonicalReused += catStats.canonicalReused;
        sourceResults.INFINITY_STORE[targetCat].offersCreated += catStats.offersCreated;
        sourceResults.INFINITY_STORE[targetCat].offersUpdated += catStats.offersUpdated;
        sourceResults.INFINITY_STORE[targetCat].skipped += catStats.skipped;

        categoryBreakdown[targetCat].fetched += catStats.fetched;
        categoryBreakdown[targetCat].supported += catStats.supported;
        categoryBreakdown[targetCat].matchable += catStats.matchable;
        categoryBreakdown[targetCat].insufficientIdentity += catStats.insufficientIdentity;
        categoryBreakdown[targetCat].failed += catStats.failed;
        categoryBreakdown[targetCat].canonicalCreated += catStats.canonicalCreated;
        categoryBreakdown[targetCat].canonicalReused += catStats.canonicalReused;
        categoryBreakdown[targetCat].offersCreated += catStats.offersCreated;
        categoryBreakdown[targetCat].offersUpdated += catStats.offersUpdated;
        categoryBreakdown[targetCat].skipped += catStats.skipped;
      }
    }
  }

  // 3. Detect Genuine Cross-Source Overlap
  const crossSourceMatches = [];
  const allCanonicals = await CanonicalProduct.find({ isActive: true }).populate('category').lean();

  for (const cp of allCanonicals) {
    const offers = await ProductOffer.find({ canonicalProduct: cp._id, isActive: true }).lean();
    const sourceNames = [...new Set(offers.map(o => o.source?.name).filter(Boolean))];
    if (sourceNames.length > 1) {
      crossSourceMatches.push({
        canonicalId: cp._id.toString(),
        canonicalKey: cp.canonicalKey,
        name: cp.name,
        brand: cp.brand,
        model: cp.model,
        category: cp.category?.slug,
        sources: sourceNames,
        offerCount: offers.length,
        offers: offers.map(o => ({
          seller: o.seller?.name || o.source?.name,
          source: o.source?.name,
          price: o.price,
          currency: o.currency
        }))
      });
    }
  }

  // 4. Inspect Overall Catalog Distribution
  const catalogDistribution = {};
  for (const slug of ['laptops', 'monitors', 'keyboards', 'mouse', 'headphones']) {
    const catDoc = await Category.findOne({ slug });
    if (catDoc) {
      const count = await CanonicalProduct.countDocuments({ category: catDoc._id, isActive: true });
      catalogDistribution[slug] = count;
    } else {
      catalogDistribution[slug] = 0;
    }
  }

  // 5. Missing Image Audit on Targeted Categories
  const missingImages = {
    laptops: { total: 0, withImages: 0, missingImages: 0 },
    headphones: { total: 0, withImages: 0, missingImages: 0 }
  };

  for (const catSlug of ['laptops', 'headphones']) {
    const catDoc = await Category.findOne({ slug: catSlug });
    if (catDoc) {
      const prods = await CanonicalProduct.find({ category: catDoc._id, isActive: true }).lean();
      missingImages[catSlug].total = prods.length;
      for (const p of prods) {
        const hasValidImg = Array.isArray(p.images) && p.images.some(u => typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://')));
        if (hasValidImg) {
          missingImages[catSlug].withImages++;
        } else {
          missingImages[catSlug].missingImages++;
        }
      }
    }
  }

  // Overall totals
  let totalCanonicalCreated = 0;
  let totalCanonicalReused = 0;
  let totalOffersCreated = 0;
  let totalOffersUpdated = 0;

  for (const cat of targetCategories) {
    totalCanonicalCreated += categoryBreakdown[cat].canonicalCreated;
    totalCanonicalReused += categoryBreakdown[cat].canonicalReused;
    totalOffersCreated += categoryBreakdown[cat].offersCreated;
    totalOffersUpdated += categoryBreakdown[cat].offersUpdated;
  }

  return {
    success: true,
    summary: {
      canonicalCreated: totalCanonicalCreated,
      canonicalReused: totalCanonicalReused,
      offersCreated: totalOffersCreated,
      offersUpdated: totalOffersUpdated,
      crossSourceMatchCount: crossSourceMatches.length
    },
    sourceResults,
    categoryBreakdown,
    crossSourceMatches,
    catalogDistribution,
    missingImages
  };
}

module.exports = {
  runTargetedCategoryCanonicalSync,
  SOURCE_CATEGORY_CONFIG,
  ensureStandardCategories
};
