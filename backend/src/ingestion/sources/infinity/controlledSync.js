const { fetchProducts } = require('./client');
const { mapInfinityProduct } = require('./mapper');
const { normalizeProduct } = require('../../normalizeProduct');
const { canonicalizeListing } = require('../../../catalog/canonicalizeListing');
const { isInsufficientIdentityReason } = require('../../../catalog/controlledEezepcSync');
const SUPPORTED_CATEGORIES = ['laptops', 'monitors', 'keyboards', 'mouse', 'headphones'];

/**
 * Creates empty category metrics object for the 5 supported categories.
 */
function createEmptyCategoryMetrics() {
  const metrics = {};
  for (const cat of SUPPORTED_CATEGORIES) {
    metrics[cat] = {
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
  return metrics;
}

/**
 * Controlled synchronization helper that processes a bounded multi-page batch of Infinity Store listings
 * through the CanonicalProduct and ProductOffer architecture.
 * 
 * @param {Object} [params]
 * @param {number} [params.startPage=1]
 * @param {number} [params.maxPages=1]
 * @param {number} [params.perPage=10]
 * @param {number} [params.page] - Legacy alias for startPage
 * @param {number} [params.limit] - Legacy alias for perPage
 * @param {Array<Object>} [params.rawProducts] - Optional direct injection of raw products (for tests)
 * @returns {Promise<{
 *   success: boolean,
 *   reason?: string,
 *   fetched: number,
 *   supported: number,
 *   matchable: number,
 *   insufficientIdentity: number,
 *   failed: number,
 *   canonicalCreated: number,
 *   canonicalReused: number,
 *   offersCreated: number,
 *   offersUpdated: number,
 *   skipped: number,
 *   categories: Object,
 *   errors: Array<Object>,
 *   details: Array<Object>
 * }>}
 */
async function runControlledInfinityCanonicalSync({
  startPage = 1,
  maxPages = 1,
  perPage = 10,
  page,
  limit,
  category = null,
  categoryFilter = null,
  rawProducts = null
} = {}) {
  const initialPage = Math.max(Number(page || startPage) || 1, 1);
  const totalPages = Math.min(Math.max(Number(maxPages) || 1, 1), 10);
  const safePerPage = Math.min(Math.max(Number(limit || perPage) || 10, 1), 20);
  const targetCategory = category || categoryFilter || null;

  const categoryMetrics = createEmptyCategoryMetrics();
  const listingResults = new Map();
  let skippedMappingCount = 0;
  const errors = [];
  let totalRawFetched = 0;

  if (rawProducts && Array.isArray(rawProducts)) {
    totalRawFetched = rawProducts.length;
    await processBatch(rawProducts);
  } else {
    // Multi-page retrieval
    for (let p = initialPage; p < initialPage + totalPages; p++) {
      const fetchResult = await fetchProducts({ page: p, perPage: safePerPage, category: targetCategory });
      if (!fetchResult.success) {
        errors.push({ error: `Infinity Store fetch failed on page ${p}: ${fetchResult.error}` });
        if (p === initialPage) {
          return {
            success: false,
            reason: fetchResult.error,
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
            categories: categoryMetrics,
            errors,
            details: []
          };
        }
        break; // Stop paginating on subsequent error
      }

      const pageProducts = fetchResult.data || [];
      totalRawFetched += pageProducts.length;

      if (pageProducts.length === 0) {
        break; // No more products available
      }

      await processBatch(pageProducts);
    }
  }

  async function processBatch(items) {
    for (const raw of items) {
      const listingKey = String(raw.id !== undefined && raw.id !== null ? raw.id : '');

      try {
        // 1. Map raw WooCommerce Store API payload
        let mapped;
        try {
          mapped = mapInfinityProduct(raw);
        } catch (err) {
          skippedMappingCount++;
          if (listingKey && !listingResults.has(listingKey)) {
            listingResults.set(listingKey, {
              rawId: raw.id,
              name: raw.name,
              category: 'unsupported',
              status: 'skipped_mapping',
              reason: err.message
            });
          }
          continue;
        }

        // Check if mapped category is supported
        if (!mapped.category) {
          skippedMappingCount++;
          if (listingKey && !listingResults.has(listingKey)) {
            listingResults.set(listingKey, {
              rawId: raw.id,
              name: raw.name,
              category: 'unsupported',
              status: 'skipped_category',
              reason: 'unsupported_or_accessory_category'
            });
          }
          continue;
        }

        // 2. Normalize product data
        const normalized = normalizeProduct(mapped);
        const effectiveKey = String(normalized.source?.listingId || listingKey);
        const resolvedCat = normalized.category || mapped.category;

        // 3. Process through Canonicalization service
        const canonicalResult = await canonicalizeListing(normalized);

        if (canonicalResult.success) {
          listingResults.set(effectiveKey, {
            listingId: normalized.source?.listingId,
            name: normalized.name,
            category: resolvedCat,
            status: 'canonicalized',
            brand: canonicalResult.brand,
            model: canonicalResult.model,
            modelIdentitySource: canonicalResult.modelIdentitySource,
            identityConfidence: canonicalResult.identityConfidence,
            canonicalKey: canonicalResult.canonicalKey,
            canonicalOperation: canonicalResult.canonicalOperation,
            offerOperation: canonicalResult.offerOperation,
            canonicalProductId: canonicalResult.canonicalProductId,
            offerId: canonicalResult.offerId
          });
        } else {
          if (isInsufficientIdentityReason(canonicalResult.reason)) {
            listingResults.set(effectiveKey, {
              listingId: normalized.source?.listingId,
              name: normalized.name,
              category: resolvedCat,
              status: 'unmatchable',
              reason: canonicalResult.reason
            });
          } else {
            // Structural error or missing category doc in DB
            errors.push({ listingId: normalized.source?.listingId, error: canonicalResult.reason });
            listingResults.set(effectiveKey, {
              listingId: normalized.source?.listingId,
              name: normalized.name,
              category: resolvedCat,
              status: 'failed',
              reason: canonicalResult.reason
            });
          }
        }
      } catch (err) {
        errors.push({ rawId: raw.id, error: err.message });
        if (listingKey) {
          listingResults.set(listingKey, {
            rawId: raw.id,
            name: raw.name,
            category: 'unknown',
            status: 'error',
            error: err.message
          });
        }
      }
    }
  }

  // Aggregate counts across unique processed listings
  const details = Array.from(listingResults.values());
  let supported = 0;
  let matchable = 0;
  let insufficientIdentity = 0;
  let failed = 0;
  let canonicalCreated = 0;
  let canonicalReused = 0;
  let offersCreated = 0;
  let offersUpdated = 0;
  let skipped = 0;

  for (const item of details) {
    const cat = item.category;
    const isKnownCat = SUPPORTED_CATEGORIES.includes(cat);

    if (isKnownCat) {
      categoryMetrics[cat].fetched++;
    }

    if (item.status === 'canonicalized') {
      supported++;
      matchable++;
      if (item.canonicalOperation === 'created') {
        canonicalCreated++;
        if (isKnownCat) categoryMetrics[cat].canonicalCreated++;
      }
      if (item.canonicalOperation === 'reused') {
        canonicalReused++;
        if (isKnownCat) categoryMetrics[cat].canonicalReused++;
      }
      if (item.offerOperation === 'created') {
        offersCreated++;
        if (isKnownCat) categoryMetrics[cat].offersCreated++;
      }
      if (item.offerOperation === 'updated') {
        offersUpdated++;
        if (isKnownCat) categoryMetrics[cat].offersUpdated++;
      }
      if (isKnownCat) {
        categoryMetrics[cat].supported++;
        categoryMetrics[cat].matchable++;
      }
    } else if (item.status === 'unmatchable') {
      supported++;
      insufficientIdentity++;
      if (isKnownCat) {
        categoryMetrics[cat].supported++;
        categoryMetrics[cat].insufficientIdentity++;
      }
    } else if (item.status === 'failed' || item.status === 'error') {
      supported++;
      failed++;
      if (isKnownCat) {
        categoryMetrics[cat].supported++;
        categoryMetrics[cat].failed++;
      }
    } else if (item.status === 'skipped_mapping' || item.status === 'skipped_category') {
      skipped++;
      if (isKnownCat) {
        categoryMetrics[cat].skipped++;
      }
    }
  }

  return {
    success: true,
    fetched: details.length > 0 ? details.length : totalRawFetched,
    supported,
    matchable,
    insufficientIdentity,
    failed,
    canonicalCreated,
    canonicalReused,
    offersCreated,
    offersUpdated,
    skipped,
    categories: categoryMetrics,
    errors,
    details
  };
}

module.exports = {
  runControlledInfinityCanonicalSync,
  SUPPORTED_CATEGORIES,
  createEmptyCategoryMetrics
};

