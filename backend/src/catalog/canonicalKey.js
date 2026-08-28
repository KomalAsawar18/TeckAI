/**
 * Normalizes brand name for deterministic canonical identity.
 * 
 * @param {string} brand - Raw brand name
 * @returns {string|null} Normalized brand or null
 */
function normalizeBrand(brand) {
  if (!brand || typeof brand !== 'string') return null;
  const cleaned = brand.trim().toLowerCase().replace(/\s+/g, ' ');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Normalizes product model number/identifier for deterministic canonical identity.
 * Preserves essential model alphanumerics and hyphens without over-stripping.
 * 
 * @param {string} model - Raw model identifier
 * @returns {string|null} Normalized model or null
 */
function normalizeModel(model) {
  if (!model || typeof model !== 'string') return null;
  // Trim surrounding spaces, lowercase, collapse internal whitespace
  let cleaned = model.trim().toLowerCase().replace(/\s+/g, ' ');
  // Remove harmless leading/trailing non-alphanumeric characters (like quotes or leading dashes)
  cleaned = cleaned.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Generates a deterministic canonicalKey from trustworthy brand and model.
 * 
 * Example:
 * brand: "ASUS", model: "FA507NV" -> "asus|fa507nv"
 * 
 * @param {Object} params
 * @param {string} params.brand - Product brand
 * @param {string} params.model - Product model / MPN
 * @returns {string|null} Deterministic canonical key or null if insufficient identity
 */
function generateCanonicalKey({ brand, model } = {}) {
  const normBrand = normalizeBrand(brand);
  const normModel = normalizeModel(model);

  if (!normBrand || !normModel) {
    return null;
  }

  return `${normBrand}|${normModel}`;
}

module.exports = {
  normalizeBrand,
  normalizeModel,
  generateCanonicalKey
};
