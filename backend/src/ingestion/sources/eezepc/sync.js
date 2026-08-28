const { fetchProducts } = require('./client');
const { mapProduct } = require('./mapper');
const { normalizeProduct } = require('../../normalizeProduct');
const { upsertProduct } = require('../../upsertProduct');

/**
 * Synchronizes a controlled page of products from the public EEZEPC WooCommerce Store API into MongoDB.
 * Performs mapping, validation, category filtering, and safe upserts.
 * 
 * @param {Object} params
 * @param {number} params.page - The page to request
 * @param {number} params.perPage - The number of products to request per page
 * @returns {Promise<Object>} Synchronization summary for the page
 */
async function syncProducts({ page = 1, perPage = 10 } = {}) {
  const pageNum = Number(page);
  const perPageNum = Number(perPage);

  // Validate inputs strictly
  if (!Number.isInteger(pageNum) || pageNum < 1 || !Number.isInteger(perPageNum) || perPageNum < 1 || perPageNum > 100) {
    return {
      success: false,
      reason: 'invalid_arguments',
      fetched: 0,
      supported: 0,
      skipped: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [{ error: 'Invalid page or perPage values. page must be >= 1, perPage must be between 1 and 100.' }]
    };
  }

  // Fetch the page of products
  const fetchResult = await fetchProducts({ page: pageNum, perPage: perPageNum });
  if (!fetchResult.success) {
    return {
      success: false,
      reason: fetchResult.reason,
      status: fetchResult.status,
      fetched: 0,
      supported: 0,
      skipped: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [{ error: `Fetch failed: ${fetchResult.reason}` }]
    };
  }

  const rawProducts = fetchResult.products || [];
  const summary = {
    success: true,
    fetched: rawProducts.length,
    supported: 0,
    skipped: 0,
    created: 0,
    updated: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < rawProducts.length; i++) {
    const rawItem = rawProducts[i];
    try {
      if (!rawItem) {
        throw new Error('Raw record is null or undefined');
      }

      // 1. Map raw item
      const mapped = mapProduct(rawItem);
      summary.supported++;

      // 2. Normalize item
      const normalized = normalizeProduct(mapped);

      // 3. Upsert item to MongoDB
      const upsertResult = await upsertProduct(normalized);
      if (upsertResult.operation === 'created') {
        summary.created++;
      } else if (upsertResult.operation === 'updated') {
        summary.updated++;
      }
    } catch (err) {
      if (err.message && err.message.includes('supported TeckAI category')) {
        summary.skipped++;
      } else {
        summary.failed++;
        summary.errors.push({
          index: i,
          listingId: rawItem && rawItem.id ? String(rawItem.id) : undefined,
          error: err.message
        });
      }
    }
  }

  return summary;
}

/**
 * Synchronizes multiple controlled pages from the EEZEPC Store API.
 * Stops on configured limits, empty responses, or API failures.
 * 
 * @param {Object} params
 * @param {number} params.startPage - The first page to request (defaults to 1)
 * @param {number} params.maxPages - The maximum number of pages to process (defaults to 3)
 * @param {number} params.perPage - The batch size per page (defaults to 10)
 * @returns {Promise<Object>} Aggregate summary of synchronization
 */
async function syncPages({ startPage = 1, maxPages = 3, perPage = 10 } = {}) {
  const start = Number(startPage);
  const max = Number(maxPages);
  const limit = Number(perPage);

  // Validate hard safety limits
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(max) || max < 1 || max > 20 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return {
      success: false,
      reason: 'invalid_arguments',
      pagesRequested: maxPages,
      pagesProcessed: 0,
      fetched: 0,
      supported: 0,
      skipped: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [{ error: 'Invalid parameters. startPage must be >= 1, maxPages must be between 1 and 20, perPage must be between 1 and 100.' }]
    };
  }

  const aggregate = {
    success: true,
    pagesRequested: max,
    pagesProcessed: 0,
    fetched: 0,
    supported: 0,
    skipped: 0,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
    pages: []
  };

  for (let i = 0; i < max; i++) {
    const pageNum = start + i;
    
    // Sync current page
    const pageResult = await syncProducts({ page: pageNum, perPage: limit });

    if (!pageResult.success) {
      aggregate.success = false;
      aggregate.reason = pageResult.reason;
      if (pageResult.status) {
        aggregate.status = pageResult.status;
      }
      aggregate.errors.push({
        page: pageNum,
        error: `Page fetch failed: ${pageResult.reason}`
      });
      // Source failure halts future page crawls
      break;
    }

    aggregate.pagesProcessed++;
    aggregate.fetched += pageResult.fetched;
    aggregate.supported += pageResult.supported;
    aggregate.skipped += pageResult.skipped;
    aggregate.created += pageResult.created;
    aggregate.updated += pageResult.updated;
    aggregate.failed += pageResult.failed;

    // Collect errors from this page
    for (const err of pageResult.errors) {
      aggregate.errors.push({
        page: pageNum,
        index: err.index,
        listingId: err.listingId,
        error: err.error
      });
    }

    // Collect per-page summary
    aggregate.pages.push({
      page: pageNum,
      fetched: pageResult.fetched,
      supported: pageResult.supported,
      skipped: pageResult.skipped,
      created: pageResult.created,
      updated: pageResult.updated,
      failed: pageResult.failed
    });

    // Check stop conditions (source exhaustion)
    if (pageResult.fetched === 0) {
      break;
    }
    if (pageResult.fetched < limit) {
      // API returned fewer products than requested -> final page reached
      break;
    }
  }

  return aggregate;
}

module.exports = {
  syncProducts,
  syncPages
};
