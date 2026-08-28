const GENERIC_TOKENS = new Set([
  'gaming', 'wireless', 'bluetooth', 'mechanical', 'magnetic', 'optical', 'wired',
  'pro', 'max', 'plus', 'ultra', 'mini', 'lite', 'super', 'extreme', 'edition',
  'series', 'keyboard', 'keyboards', 'mouse', 'mice', 'monitor', 'monitors',
  'laptop', 'laptops', 'notebook', 'headphone', 'headphones', 'headset', 'headsets',
  'earphone', 'earphones', 'earbuds', 'rgb', 'led', 'oled', 'ips', 'fhd', 'qhd', 'uhd',
  '4k', '2k', '1080p', '144hz', '165hz', '240hz', '360hz', 'usb', 'typec', 'adapter',
  'black', 'white', 'gray', 'grey', 'red', 'blue', 'green', 'yellow', 'pink', 'purple',
  'gold', 'silver', 'starry', 'sky', 'contour', 'matte', 'glossy', 'speed', 'control',
  'switch', 'switches', 'controller', 'gamepad', 'accessories', 'accessory',
  'used', 'new', 'openbox', 'sealed', 'custom', 'official', 'original', 'pakistan',
  'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'gen1', 'gen2', 'gen3', 'gen4',
  '2020', '2021', '2022', '2023', '2024', '2025', '2026'
]);

/**
 * Normalizes an alphanumeric string by lowercasing and removing non-alphanumerics.
 * 
 * @param {string} str 
 * @returns {string}
 */
function cleanAlphaNum(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if a normalized token is purely generic or non-identifying.
 * 
 * @param {string} cleanToken 
 * @returns {boolean}
 */
function isGenericToken(cleanToken) {
  if (!cleanToken || cleanToken.length < 2) return true;
  if (/^\d+$/.test(cleanToken)) return true; // pure numeric sequences
  if (/^[a-z]+$/.test(cleanToken) && GENERIC_TOKENS.has(cleanToken)) return true;
  return false;
}

/**
 * Checks whether a token contains sufficient alphanumeric structure to be a model.
 * Requires at least 3 characters and at least one digit and one letter (or valid model structure).
 * 
 * @param {string} cleanToken 
 * @returns {boolean}
 */
function isValidModelStructure(cleanToken) {
  if (!cleanToken || cleanToken.length < 3) return false;
  if (isGenericToken(cleanToken)) return false;

  const hasLetter = /[a-z]/.test(cleanToken);
  const hasDigit = /[0-9]/.test(cleanToken);

  // Must have both letter and number, or be a composite alphanumeric identifier >= 5 chars
  return (hasLetter && hasDigit) || (cleanToken.length >= 5 && !isGenericToken(cleanToken));
}

/**
 * Deterministically extracts model identity following strict confidence hierarchy:
 * 1. Explicit Model structured attribute
 * 2. Explicit MPN structured attribute
 * 3. Corroborated Title + SKU model token
 * 4. Otherwise null (insufficient_model_identity)
 * 
 * @param {Object} params
 * @param {string} [params.brand] - Trustworthy structured brand
 * @param {string} [params.title] - Product title/name
 * @param {string} [params.sku] - Product SKU
 * @param {Object} [params.specifications] - Extracted specifications dictionary
 * @param {Array<Object>} [params.attributes] - Raw attributes array
 * @returns {{
 *   model: string|null,
 *   modelIdentitySource: 'explicit_attribute'|'title_sku_corroborated'|null,
 *   identityConfidence: 'high'|'none'
 * }}
 */
function extractCorroboratedModel({ brand, model, title, sku, specifications = {}, attributes = [] } = {}) {
  // 1 & 2: Check explicit structured model/MPN attributes first
  if (typeof model === 'string' && model.trim().length > 0) {
    return {
      model: model.trim(),
      modelIdentitySource: 'explicit_attribute',
      identityConfidence: 'high'
    };
  }

  const explicitCandidates = [
    specifications.model,
    specifications.model_number,
    specifications.model_no,
    specifications.mpn,
    specifications.part_number,
    specifications.item_model_number
  ];

  for (const val of explicitCandidates) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return {
        model: val.trim(),
        modelIdentitySource: 'explicit_attribute',
        identityConfidence: 'high'
      };
    }
  }

  // Also check raw attributes array if passed
  if (Array.isArray(attributes)) {
    for (const attr of attributes) {
      const name = (attr.name || '').toLowerCase().trim();
      const taxonomy = (attr.taxonomy || '').toLowerCase().trim();
      if (name === 'model' || name === 'model number' || name === 'mpn' || taxonomy === 'pa_model' || taxonomy === 'pa_mpn') {
        let val;
        if (Array.isArray(attr.terms) && attr.terms.length > 0 && attr.terms[0].name) {
          val = String(attr.terms[0].name).trim();
        } else if (Array.isArray(attr.options) && attr.options.length > 0) {
          val = String(attr.options[0]).trim();
        } else if (typeof attr.value === 'string' && attr.value.trim().length > 0) {
          val = attr.value.trim();
        }
        if (val) {
          return {
            model: val,
            modelIdentitySource: 'explicit_attribute',
            identityConfidence: 'high'
          };
        }
      }
    }
  }

  // 3: Corroborated Title + SKU rule
  // Requires trustworthy brand, title, and SKU
  const normBrand = typeof brand === 'string' ? brand.trim() : '';
  const normTitle = typeof title === 'string' ? title.trim() : '';
  const normSku = typeof sku === 'string' ? sku.trim() : '';

  if (!normBrand || !normTitle || !normSku) {
    return {
      model: null,
      modelIdentitySource: null,
      identityConfidence: 'none'
    };
  }

  const cleanSku = cleanAlphaNum(normSku);
  const cleanBrand = cleanAlphaNum(normBrand);

  // Extract model candidate phrases from title (removing brand if at the start)
  let workingTitle = normTitle;
  if (normTitle.toLowerCase().startsWith(normBrand.toLowerCase())) {
    workingTitle = normTitle.slice(normBrand.length).trim();
  }

  // Extract candidate tokens matching model patterns (e.g. AK680 V2, AJ159 Pro, XG32UCWG)
  // Match patterns like letters+digits or multi-token model designations
  const tokenRegex = /\b([A-Za-z0-9]+(?:[- ][A-Za-z0-9]+)*)\b/g;
  let match;
  const candidatePhrases = [];

  while ((match = tokenRegex.exec(workingTitle)) !== null) {
    const phrase = match[1].trim();
    if (phrase.length >= 2) {
      candidatePhrases.push(phrase);
    }
  }

  // Also include sub-slices of phrases (e.g., from "AK680 V2 Magnetic Switch" -> test "AK680 V2", "AK680")
  const candidatesToTest = [];
  for (const phrase of candidatePhrases) {
    const words = phrase.split(/[\s-]+/);
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= Math.min(i + 3, words.length); j++) {
        const subPhrase = words.slice(i, j).join('');
        candidatesToTest.push(subPhrase);
      }
    }
  }

  // Sort candidates by length descending to prefer more specific models (e.g. "AK680V2" over "AK680")
  candidatesToTest.sort((a, b) => b.length - a.length);

  // Pass 1: Exact match with SKU or SKU stripped of brand prefix
  for (const cand of candidatesToTest) {
    const cleanCand = cleanAlphaNum(cand);
    if (!isValidModelStructure(cleanCand)) continue;

    let skuToMatch = cleanSku;
    if (cleanBrand && skuToMatch.startsWith(cleanBrand)) {
      skuToMatch = skuToMatch.slice(cleanBrand.length);
    }

    if (cleanCand === cleanSku || cleanCand === skuToMatch) {
      return {
        model: cleanCand.toUpperCase(),
        modelIdentitySource: 'title_sku_corroborated',
        identityConfidence: 'high'
      };
    }
  }

  // Pass 2: Substring match where SKU contains the candidate model token
  for (const cand of candidatesToTest) {
    const cleanCand = cleanAlphaNum(cand);
    if (!isValidModelStructure(cleanCand)) continue;

    let skuToMatch = cleanSku;
    if (cleanBrand && skuToMatch.startsWith(cleanBrand)) {
      skuToMatch = skuToMatch.slice(cleanBrand.length);
    }

    if (cleanSku.includes(cleanCand) || skuToMatch.includes(cleanCand)) {
      return {
        model: cleanCand.toUpperCase(),
        modelIdentitySource: 'title_sku_corroborated',
        identityConfidence: 'high'
      };
    }
  }

  // 4: Otherwise insufficient model identity
  return {
    model: null,
    modelIdentitySource: null,
    identityConfidence: 'none'
  };
}

module.exports = {
  extractCorroboratedModel,
  cleanAlphaNum,
  isGenericToken,
  isValidModelStructure,
  GENERIC_TOKENS
};
