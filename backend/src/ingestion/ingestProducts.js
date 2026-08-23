const { normalizeProduct } = require('./normalizeProduct');
const { upsertProduct } = require('./upsertProduct');

/**
 * Processes a batch of raw records by mapping, normalizing, resolving categories, and upserting them.
 * One invalid product will not block other products in the batch from being processed.
 * 
 * @param {Array} rawProducts - Array of raw product payloads from external connectors
 * @param {Function} [mapper] - Optional connector-specific mapping function
 * @returns {Promise<Object>} Summary of the batch operation
 */
async function ingestProducts(rawProducts, mapper) {
  if (!Array.isArray(rawProducts)) {
    throw new Error('rawProducts must be an array');
  }

  const summary = {
    total: rawProducts.length,
    created: 0,
    updated: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < rawProducts.length; i++) {
    const rawItem = rawProducts[i];
    try {
      if (!rawItem) {
        throw new Error('Record is null or undefined');
      }

      // 1. Map raw connector record to intermediate format
      const mapped = mapper ? mapper(rawItem) : rawItem;

      // 2. Normalize and validate schema/data values
      const normalized = normalizeProduct(mapped);

      // 3. Persist via safe upsert
      const result = await upsertProduct(normalized);

      // 4. Update stats
      if (result.operation === 'created') {
        summary.created++;
      } else if (result.operation === 'updated') {
        summary.updated++;
      }
    } catch (err) {
      summary.failed++;
      summary.errors.push({
        index: i,
        name: rawItem && rawItem.name ? String(rawItem.name).trim() : undefined,
        error: err.message
      });
    }
  }

  return summary;
}

module.exports = { ingestProducts };
