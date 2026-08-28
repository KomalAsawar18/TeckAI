const COLOR_WORDS = new Set([
  'black', 'white', 'gray', 'grey', 'red', 'blue', 'green', 'yellow', 'pink',
  'purple', 'gold', 'silver', 'starry', 'sky', 'contour', 'matte', 'glossy',
  'orange', 'cyan', 'magenta', 'navy', 'crimson', 'emerald', 'teal', 'violet',
  'bronze', 'copper', 'carbon', 'titanium', 'rosegold', 'spacegray', 'midnight'
]);

const VARIANT_SPEC_KEYS = new Set([
  'color', 'colour', 'pa_color', 'pa_colour',
  'warranty', 'pa_warranty', 'retailer_warranty',
  'sku', 'pa_sku', 'stock_code'
]);

/**
 * Validates and converts image items into an array of string HTTP/HTTPS URLs.
 * Completely eliminates any "[object Object]" artifacts.
 * 
 * @param {Array<string|Object>} images 
 * @returns {Array<string>}
 */
function sanitizeImages(images) {
  if (!Array.isArray(images)) return [];

  const result = [];
  for (const img of images) {
    let url = '';
    if (typeof img === 'string') {
      url = img.trim();
    } else if (img && typeof img === 'object') {
      if (typeof img.url === 'string') url = img.url.trim();
      else if (typeof img.src === 'string') url = img.src.trim();
    }

    if (
      url &&
      (url.startsWith('http://') || url.startsWith('https://')) &&
      !url.includes('[object Object]')
    ) {
      result.push(url);
    }
  }

  return result;
}

/**
 * Checks if a string phrase appears to represent a color or aesthetic finish.
 * 
 * @param {string} phrase 
 * @returns {boolean}
 */
function isColorPhrase(phrase) {
  if (!phrase || typeof phrase !== 'string') return false;
  const words = phrase.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/);
  if (words.length === 0) return false;

  // If at least one word is in COLOR_WORDS, and words are not product category names
  const hasColorWord = words.some(w => COLOR_WORDS.has(w));
  const hasCategoryWord = words.some(w => ['keyboard', 'mouse', 'monitor', 'laptop', 'headphone'].includes(w));
  return hasColorWord && !hasCategoryWord;
}

/**
 * Conservatively derives a base physical product display name by stripping
 * corroborated trailing variant attributes (such as structured color suffixes).
 * 
 * Does NOT perform arbitrary marketing title rewriting.
 * Preserves original name if safe variant removal cannot be proven.
 * 
 * @param {Object} params
 * @param {string} params.name - Original product name/title
 * @param {string} [params.brand] - Brand name
 * @param {string} [params.model] - Model name
 * @param {string} [params.color] - Known structured color
 * @returns {string} Clean base canonical name
 */
function deriveCanonicalName({ name = '', brand, model, color } = {}) {
  if (!name || typeof name !== 'string') return '';
  const trimmedName = name.trim();

  // Pattern: Title separated by en-dash, em-dash, hyphen, pipe, or slash at the end
  const separatorMatch = trimmedName.match(/^(.*?)\s*([–—\-|/])\s*([^–—\-|/]+)$/);
  if (separatorMatch) {
    const basePart = separatorMatch[1].trim();
    const suffix = separatorMatch[3].trim();

    // Check if the suffix represents a corroborated color/finish
    const isCorroboratedColor = (color && suffix.toLowerCase().includes(color.toLowerCase())) ||
      (color && color.toLowerCase().includes(suffix.toLowerCase())) ||
      isColorPhrase(suffix);

    if (isCorroboratedColor) {
      // Safety check: base part must still contain the model or brand or be >= 5 chars
      if (basePart.length >= 5) {
        return basePart;
      }
    }
  }

  return trimmedName;
}

/**
 * Filters out listing-specific, dynamic, and variant-level keys from specifications,
 * preserving only stable manufacturer/hardware specifications.
 * 
 * @param {Object} specifications 
 * @returns {Object} Clean canonical specifications dictionary
 */
function filterCanonicalSpecifications(specifications = {}) {
  if (!specifications || typeof specifications !== 'object') return {};

  const cleanSpecs = {};
  for (const [key, value] of Object.entries(specifications)) {
    const normKey = key.toLowerCase().trim();
    if (!VARIANT_SPEC_KEYS.has(normKey) && value !== undefined && value !== null) {
      cleanSpecs[key] = value;
    }
  }

  return cleanSpecs;
}

/**
 * Extracts offer-level variant metadata (color, configuration).
 * 
 * @param {Object} product - Mapped/normalized product payload
 * @returns {{ color?: string, configuration?: string }}
 */
function extractOfferVariant(product = {}) {
  let color = product.variant?.color;
  
  if (!color) {
    // Check title suffix for color
    const title = product.name || '';
    const match = title.match(/[–—\-|/]\s*([^–—\-|/]+)$/);
    if (match && isColorPhrase(match[1].trim())) {
      color = match[1].trim();
    } else if (product.specifications?.color) {
      color = product.specifications.color;
    }
  }

  let configuration = product.variant?.configuration || product.specifications?.configuration;

  return {
    color: color ? String(color).trim() : undefined,
    configuration: configuration ? String(configuration).trim() : undefined
  };
}

/**
 * Classifies headphones into a specific structured audio subtype.
 * 
 * @param {string} name 
 * @param {Object} specs 
 * @returns {string} subtype
 */
function classifyAudioSubtype(name = '', specs = {}) {
  const text = (name + ' ' + Object.values(specs).join(' ')).toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  
  if (text.includes('wh 1000') || text.includes('airpods max')) return 'over_ear';
  if (text.includes('true wireless') || text.includes('tws') || text.match(/\b(airpods pro|airpods|liberty buds|sleep a30|aeroclip)\b/)) return 'true_wireless_earbuds';
  if (text.includes('earbud') || text.includes('ear bud') || text.match(/\bbuds\b/)) return 'earbuds';
  if (text.includes('in ear') || text.includes('iem') || text.includes('in ear monitors')) return 'in_ear';
  if (text.includes('over ear')) return 'over_ear';
  if (text.includes('on ear')) return 'on_ear';
  if (text.includes('headset') || text.match(/\b(gaming headset|usb headset)\b/)) return 'headset';
  
  return 'unknown';
}

module.exports = {
  sanitizeImages,
  isColorPhrase,
  deriveCanonicalName,
  filterCanonicalSpecifications,
  extractOfferVariant,
  classifyAudioSubtype,
  COLOR_WORDS,
  VARIANT_SPEC_KEYS
};
