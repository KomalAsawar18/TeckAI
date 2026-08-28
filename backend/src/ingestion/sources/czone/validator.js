const { fetchProductPage } = require('./client');
const { parseProductHtml } = require('./parser');
const { mapProduct } = require('./mapper');
const { normalizeProduct } = require('../../normalizeProduct');

/**
 * Validates a single live Czone product page by fetching, parsing, mapping, and normalizing it.
 * Does NOT persist the product to the database.
 * 
 * @param {string} url - The live product URL
 * @returns {Promise<Object>} The validation result object
 */
async function validateLiveProduct(url) {
  const fetchResult = await fetchProductPage(url);
  if (!fetchResult.success) {
    return fetchResult;
  }

  try {
    const parsed = parseProductHtml(fetchResult.html, url);
    const mapped = mapProduct(parsed);
    const normalized = normalizeProduct(mapped);

    return {
      success: true,
      rawStatus: fetchResult.rawStatus,
      product: normalized
    };
  } catch (error) {
    return {
      success: false,
      reason: 'unexpected_content',
      error: error.message
    };
  }
}

module.exports = {
  validateLiveProduct
};
