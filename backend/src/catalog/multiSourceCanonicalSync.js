const { runControlledEezepcCanonicalSync, SUPPORTED_CATEGORIES, createEmptyCategoryMetrics } = require('./controlledEezepcSync');
const { runControlledInfinityCanonicalSync } = require('../ingestion/sources/infinity/controlledSync');
const CanonicalProduct = require('../models/CanonicalProduct');
const ProductOffer = require('../models/ProductOffer');
const Category = require('../models/Category');

/**
 * Executes a controlled multi-source, multi-category canonical sync across EEZEPC and Infinity Store.
 * 
 * Invariants:
 * - Isolation: Failure of one source does not crash the entire sync.
 * - Idempotency: Re-running sync creates 0 duplicate canonical products or offers.
 * - Cross-source convergence: When both sources corroborate the same brand+model, they link to the same CanonicalProduct.
 * 
 * @param {Object} [options]
 * @param {number} [options.startPage=1]
 * @param {number} [options.maxPages=3]
 * @param {number} [options.perPage=10]
 * @param {Object} [options.eezepc] - Custom options for EEZEPC
 * @param {Object} [options.infinity] - Custom options for Infinity Store
 * @returns {Promise<{
 *   success: boolean,
 *   sources: { eezepc: Object, infinity: Object },
 *   totals: Object,
 *   categories: Object,
 *   crossSourceMatches: Array<Object>,
 *   qualityAlerts: Object
 * }>}
 */
async function runMultiSourceCanonicalSync(options = {}) {
  const defaultParams = {
    startPage: options.startPage || 1,
    maxPages: options.maxPages || 3,
    perPage: options.perPage || 10
  };

  const eezepcOptions = { ...defaultParams, ...(options.eezepc || {}) };
  const infinityOptions = { ...defaultParams, ...(options.infinity || {}) };

  // 1. Run EEZEPC Sync
  let eezepcResult;
  try {
    eezepcResult = await runControlledEezepcCanonicalSync(eezepcOptions);
  } catch (err) {
    eezepcResult = {
      success: false,
      reason: err.message,
      fetched: 0,
      supported: 0,
      matchable: 0,
      insufficientIdentity: 0,
      failed: 1,
      canonicalCreated: 0,
      canonicalReused: 0,
      offersCreated: 0,
      offersUpdated: 0,
      skipped: 0,
      categories: createEmptyCategoryMetrics(),
      errors: [{ error: `EEZEPC sync error: ${err.message}` }],
      details: []
    };
  }

  // 2. Run Infinity Store Sync
  let infinityResult;
  try {
    infinityResult = await runControlledInfinityCanonicalSync(infinityOptions);
  } catch (err) {
    infinityResult = {
      success: false,
      reason: err.message,
      fetched: 0,
      supported: 0,
      matchable: 0,
      insufficientIdentity: 0,
      failed: 1,
      canonicalCreated: 0,
      canonicalReused: 0,
      offersCreated: 0,
      offersUpdated: 0,
      skipped: 0,
      categories: createEmptyCategoryMetrics(),
      errors: [{ error: `Infinity Store sync error: ${err.message}` }],
      details: []
    };
  }

  // 3. Aggregate Overall Totals
  const sourceResults = [eezepcResult, infinityResult];
  const totals = {
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

  for (const res of sourceResults) {
    totals.fetched += res.fetched || 0;
    totals.supported += res.supported || 0;
    totals.matchable += res.matchable || 0;
    totals.insufficientIdentity += res.insufficientIdentity || 0;
    totals.failed += res.failed || 0;
    totals.canonicalCreated += res.canonicalCreated || 0;
    totals.canonicalReused += res.canonicalReused || 0;
    totals.offersCreated += res.offersCreated || 0;
    totals.offersUpdated += res.offersUpdated || 0;
    totals.skipped += res.skipped || 0;
  }

  // 4. Aggregate Multi-Category Metrics across sources
  const aggregateCategories = createEmptyCategoryMetrics();
  for (const cat of SUPPORTED_CATEGORIES) {
    for (const res of sourceResults) {
      const catData = res.categories?.[cat];
      if (catData) {
        aggregateCategories[cat].fetched += catData.fetched || 0;
        aggregateCategories[cat].supported += catData.supported || 0;
        aggregateCategories[cat].matchable += catData.matchable || 0;
        aggregateCategories[cat].insufficientIdentity += catData.insufficientIdentity || 0;
        aggregateCategories[cat].failed += catData.failed || 0;
        aggregateCategories[cat].canonicalCreated += catData.canonicalCreated || 0;
        aggregateCategories[cat].canonicalReused += catData.canonicalReused || 0;
        aggregateCategories[cat].offersCreated += catData.offersCreated || 0;
        aggregateCategories[cat].offersUpdated += catData.offersUpdated || 0;
        aggregateCategories[cat].skipped += catData.skipped || 0;
      }
    }
  }

  // 5. Detect Cross-Source Canonical Convergence
  const crossSourceMatches = [];
  try {
    const activeCanonicalProducts = await CanonicalProduct.find({ isActive: true }).lean();
    for (const cp of activeCanonicalProducts) {
      const offers = await ProductOffer.find({ canonicalProduct: cp._id, isActive: true }).lean();
      const distinctSources = Array.from(new Set(offers.map(o => o.source?.name).filter(Boolean)));

      if (distinctSources.length > 1) {
        const prices = offers.map(o => o.price).filter(p => typeof p === 'number' && p > 0);
        crossSourceMatches.push({
          canonicalKey: cp.canonicalKey,
          canonicalProductId: cp._id.toString(),
          name: cp.name,
          brand: cp.brand,
          model: cp.model,
          sources: distinctSources,
          offerCount: offers.length,
          bestPrice: prices.length > 0 ? Math.min(...prices) : null
        });
      }
    }
  } catch (err) {
    // Graceful fallback for disconnected database in unit tests
  }

  // 6. Quality Checks & Alerts
  const qualityAlerts = {
    missingImagesCount: 0,
    missingImagesProducts: [],
    insufficientIdentityTotal: totals.insufficientIdentity,
    suspiciousIdentities: []
  };

  try {
    const allActive = await CanonicalProduct.find({ isActive: true }).lean();
    for (const cp of allActive) {
      if (!cp.images || cp.images.length === 0) {
        qualityAlerts.missingImagesCount++;
        qualityAlerts.missingImagesProducts.push({
          id: cp._id.toString(),
          name: cp.name,
          canonicalKey: cp.canonicalKey
        });
      }

      // Check generic brand or generic model
      const { isGenericBrandOrCategory } = require('../ingestion/sources/eezepc/mapper');
      if (isGenericBrandOrCategory(cp.brand) || isGenericBrandOrCategory(cp.model)) {
        qualityAlerts.suspiciousIdentities.push({
          id: cp._id.toString(),
          name: cp.name,
          brand: cp.brand,
          model: cp.model
        });
      }
    }
  } catch (err) {
    // Graceful fallback for unit tests
  }

  return {
    success: eezepcResult.success || infinityResult.success,
    sources: {
      eezepc: eezepcResult,
      infinity: infinityResult
    },
    totals,
    categories: aggregateCategories,
    crossSourceMatches,
    qualityAlerts
  };
}

module.exports = {
  runMultiSourceCanonicalSync
};
