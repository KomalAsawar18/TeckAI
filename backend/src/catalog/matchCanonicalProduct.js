const CanonicalProduct = require('../models/CanonicalProduct');
const { generateCanonicalKey, normalizeBrand, normalizeModel } = require('./canonicalKey');

/**
 * Deterministically finds an existing CanonicalProduct match in the database.
 * 
 * Strict Matching Rules:
 * 1. Requires trustworthy canonicalKey or both brand and model.
 * 2. Never matches on product name alone.
 * 3. Never uses fuzzy/AI/probabilistic heuristics.
 * 4. Returns 'insufficient_identity' or 'no_match' if no deterministic match is found.
 * 
 * @param {Object} candidate - Candidate product data
 * @param {string} [candidate.canonicalKey] - Explicit canonical key if already computed
 * @param {string} [candidate.brand] - Product brand
 * @param {string} [candidate.model] - Product model / MPN
 * @param {string} [candidate.name] - Product name (never used alone for matching)
 * @param {Object} [options]
 * @param {Object} [options.CanonicalProductModel] - Optional injected Mongoose model (for testing/mocking)
 * @returns {Promise<{ match: Object|null, reason?: string, method?: string, canonicalKey?: string|null, matchable: boolean }>}
 */
async function matchCanonicalProduct(candidate = {}, options = {}) {
  const Model = options.CanonicalProductModel || CanonicalProduct;

  if (!candidate || typeof candidate !== 'object') {
    return {
      match: null,
      reason: 'invalid_candidate',
      matchable: false,
      canonicalKey: null
    };
  }

  // 1. Resolve canonicalKey deterministically
  let key = candidate.canonicalKey;
  if (!key && candidate.brand && candidate.model) {
    key = generateCanonicalKey({ brand: candidate.brand, model: candidate.model });
  }

  // 2. If no trustworthy model/brand key exists, fail safe to prevent merging distinct items
  if (!key) {
    return {
      match: null,
      reason: 'insufficient_identity',
      matchable: false,
      canonicalKey: null
    };
  }

  // 3. Exact deterministic database lookup by canonicalKey
  const existing = await Model.findOne({ canonicalKey: key, isActive: true });

  if (existing) {
    return {
      match: existing,
      method: 'canonical_key',
      canonicalKey: key,
      matchable: true
    };
  }

  return {
    match: null,
    reason: 'no_match',
    canonicalKey: key,
    matchable: true
  };
}

/**
 * Evaluates whether two product candidates deterministically represent the same device in-memory.
 * 
 * @param {Object} itemA 
 * @param {Object} itemB 
 * @returns {{ matched: boolean, reason?: string, method?: string, canonicalKey?: string }}
 */
function evaluateDeterministicMatch(itemA = {}, itemB = {}) {
  const keyA = itemA.canonicalKey || generateCanonicalKey({ brand: itemA.brand, model: itemA.model });
  const keyB = itemB.canonicalKey || generateCanonicalKey({ brand: itemB.brand, model: itemB.model });

  if (!keyA || !keyB) {
    return {
      matched: false,
      reason: 'insufficient_identity'
    };
  }

  if (keyA === keyB) {
    return {
      matched: true,
      method: 'canonical_key',
      canonicalKey: keyA
    };
  }

  return {
    matched: false,
    reason: 'key_mismatch'
  };
}

module.exports = {
  matchCanonicalProduct,
  evaluateDeterministicMatch
};
