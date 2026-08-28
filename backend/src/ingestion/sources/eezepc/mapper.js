const cheerio = require('cheerio');

/**
 * Safely decodes HTML entities and trims white space.
 * 
 * @param {string} str - Raw input string
 * @returns {string} Cleaned plain text
 */
function cleanText(str) {
  if (!str) return '';
  return cheerio.load(`<span>${str}</span>`)('span').text().trim();
}

/**
 * Strips HTML tags and decodes HTML entities to produce clean plain text.
 * 
 * @param {string} html - Raw HTML content
 * @returns {string} Stripped plain text
 */
function cleanDescription(html) {
  if (!html) return '';
  const $ = cheerio.load(`<div>${html}</div>`);
  // Remove potentially executable elements
  $('script, style').remove();
  return $.text().trim();
}

/**
 * Excluded accessory / peripheral keywords that should NEVER map to core product categories.
 */
const EXCLUDED_ACCESSORY_PATTERNS = [
  'pad', 'pads', 'mat', 'mats', 'mousepad', 'mousepads', 'bungee', 'bungees',
  'grip', 'grips', 'skate', 'skates', 'feet', 'glides',
  'wrist rest', 'wrist-rest', 'wristrest', 'keycap', 'keycaps', 'switch', 'switches',
  'puller', 'lube', 'stabilizer', 'stabilizers',
  'bag', 'bags', 'backpack', 'backpacks', 'sleeve', 'sleeves', 'cover', 'covers', 'case', 'cases',
  'stand', 'stands', 'arm', 'arms', 'mount', 'mounts', 'bracket', 'brackets',
  'holder', 'holders', 'dock', 'docks', 'hub', 'hubs',
  'charger', 'chargers', 'cable', 'cables', 'adapter', 'adapters', 'power bank',
  'earpad', 'earpads', 'ear pad', 'ear pads', 'cushion', 'cushions', 'headband', 'tips', 'eartips',
  'accessory', 'accessories', 'spare', 'parts', 'cleaner', 'cleaning', 'protector', 'lightbar', 'cooling'
];

/**
 * Checks if a category slug or name indicates an accessory rather than a core device.
 * 
 * @param {string} slug - Raw category slug
 * @param {string} name - Raw category name
 * @returns {boolean} True if accessory
 */
function isAccessoryCategory(slug, name) {
  const normSlug = (slug || '').toLowerCase().trim();
  const normName = (name || '').toLowerCase().trim();

  for (const pattern of EXCLUDED_ACCESSORY_PATTERNS) {
    const slugParts = normSlug.split(/[^a-z0-9]+/);
    const nameParts = normName.split(/[^a-z0-9]+/);

    if (slugParts.includes(pattern) || nameParts.includes(pattern)) {
      return true;
    }

    if (pattern.includes(' ') || pattern.includes('-')) {
      const cleanPattern = pattern.replace(/[-_ ]+/g, ' ');
      const cleanName = normName.replace(/[-_ ]+/g, ' ');
      const cleanSlug = normSlug.replace(/[-_ ]+/g, ' ');
      if (cleanName.includes(cleanPattern) || cleanSlug.includes(cleanPattern)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Maps a single EEZEPC WooCommerce category slug/name to TeckAI supported category slugs.
 * Excludes accessory categories (e.g. mouse pads, headphone cases, cables).
 * 
 * @param {string} slug - Raw category slug
 * @param {string} name - Raw category name
 * @returns {string|null} Normalized category slug or null
 */
function mapSingleCategory(slug, name) {
  if (isAccessoryCategory(slug, name)) {
    return null;
  }

  const normSlug = (slug || '').toLowerCase().trim();
  const normName = (name || '').toLowerCase().trim();

  // 1. Laptops
  const laptopSlugs = ['laptops', 'laptop', 'gaming-laptops', 'gaming-laptop', 'business-laptops', 'notebooks', 'notebook', 'ultrabooks', 'ultrabook'];
  if (
    laptopSlugs.includes(normSlug) ||
    normSlug.startsWith('laptop') ||
    normSlug.startsWith('gaming-laptop') ||
    normName === 'laptops' ||
    normName === 'laptop' ||
    normName === 'gaming laptops' ||
    normName === 'gaming laptop' ||
    normName === 'notebooks' ||
    normName === 'notebook' ||
    normName === 'ultrabooks' ||
    normName === 'ultrabook'
  ) {
    return 'laptops';
  }

  // 2. Monitors
  const monitorSlugs = ['monitors', 'monitor', 'gaming-monitors', 'gaming-monitor', 'oled-monitors', 'curved-monitors', 'lcd-monitors', 'led-monitors', 'pc-monitors', 'displays', 'display'];
  if (
    monitorSlugs.includes(normSlug) ||
    normSlug.startsWith('monitor') ||
    normSlug.startsWith('gaming-monitor') ||
    normName === 'monitors' ||
    normName === 'monitor' ||
    normName === 'gaming monitors' ||
    normName === 'gaming monitor' ||
    normName === 'oled monitors' ||
    normName === 'curved monitors' ||
    normName === 'lcd monitors' ||
    normName === 'led monitors' ||
    normName === 'displays' ||
    normName === 'display'
  ) {
    return 'monitors';
  }

  // 3. Keyboards
  const keyboardSlugs = ['keyboards', 'keyboard', 'gaming-keyboards', 'gaming-keyboard', 'mechanical-keyboards', 'mechanical-keyboard', 'wireless-keyboards', 'wireless-keyboard'];
  if (
    keyboardSlugs.includes(normSlug) ||
    normSlug.startsWith('keyboard') ||
    normSlug.startsWith('gaming-keyboard') ||
    normName === 'keyboards' ||
    normName === 'keyboard' ||
    normName === 'gaming keyboards' ||
    normName === 'gaming keyboard' ||
    normName === 'mechanical keyboards' ||
    normName === 'mechanical keyboard' ||
    normName === 'wireless keyboards' ||
    normName === 'wireless keyboard'
  ) {
    return 'keyboards';
  }

  // 4. Mouse
  const mouseSlugs = ['mouse', 'mice', 'gaming-mouse', 'gaming-mice', 'wireless-mouse', 'wireless-mice', 'optical-mouse', 'laser-mouse', 'bluetooth-mouse', 'trackball-mouse', 'wired-mouse', 'mice-mouse'];
  if (
    mouseSlugs.includes(normSlug) ||
    normSlug === 'gaming-mouse' ||
    normSlug === 'gaming-mice' ||
    normName === 'mouse' ||
    normName === 'mice' ||
    normName === 'gaming mouse' ||
    normName === 'gaming mice' ||
    normName === 'wireless mouse' ||
    normName === 'wireless mice' ||
    normName === 'optical mouse' ||
    normName === 'laser mouse' ||
    normName === 'bluetooth mouse' ||
    normName === 'trackball mouse' ||
    normName === 'wired mouse' ||
    normName === 'ergonomic mouse'
  ) {
    return 'mouse';
  }

  // 5. Headphones
  const headphoneSlugs = ['headphones', 'headphone', 'headsets', 'headset', 'gaming-headphones', 'gaming-headsets', 'gaming-headset', 'wireless-headphones', 'wireless-headsets', 'earphones', 'earphone', 'earbuds', 'in-ear-monitors', 'iems', 'tws'];
  if (
    headphoneSlugs.includes(normSlug) ||
    normSlug.startsWith('headphone') ||
    normSlug.startsWith('headset') ||
    normSlug.startsWith('gaming-headphone') ||
    normSlug.startsWith('gaming-headset') ||
    normName === 'headphones' ||
    normName === 'headphone' ||
    normName === 'headsets' ||
    normName === 'headset' ||
    normName === 'headphones/headsets' ||
    normName === 'headphones / headsets' ||
    normName === 'gaming headphones' ||
    normName === 'gaming headphone' ||
    normName === 'gaming headsets' ||
    normName === 'gaming headset' ||
    normName === 'wireless headphones' ||
    normName === 'wireless headsets' ||
    normName === 'bluetooth headphones' ||
    normName === 'earphones' ||
    normName === 'earphone' ||
    normName === 'earbuds' ||
    normName === 'in-ear monitors' ||
    normName === 'in ear monitors' ||
    normName === 'iems'
  ) {
    return 'headphones';
  }

  return null;
}

/**
 * Resolves the primary TeckAI category from all categories associated with a product.
 * 
 * @param {Array} categories - Array of raw category objects
 * @returns {string} Resolved TeckAI category slug
 * @throws {Error} If no supported category matches
 */
function resolveCategory(categories) {
  if (!Array.isArray(categories)) {
    throw new Error('Categories must be an array');
  }

  for (const cat of categories) {
    const resolved = mapSingleCategory(cat.slug, cat.name);
    if (resolved) {
      return resolved;
    }
  }

  throw new Error('Product does not belong to any supported TeckAI category');
}

/**
 * Maps WooCommerce prices object to numeric PKR value.
 * 
 * @param {Object} prices - The raw prices object
 * @returns {number} The converted numeric price in PKR
 * @throws {Error} If price metadata is malformed or invalid
 */
function convertPrice(prices) {
  if (!prices || prices.price === undefined || prices.price === null) {
    throw new Error('Invalid or missing prices.price value');
  }

  const priceStr = String(prices.price).trim();
  if (priceStr.length === 0 || isNaN(Number(priceStr))) {
    throw new Error('prices.price is not a numeric value');
  }

  if (prices.currency_minor_unit === undefined || prices.currency_minor_unit === null) {
    throw new Error('Invalid or missing prices.currency_minor_unit value');
  }

  const minorUnit = Number(prices.currency_minor_unit);
  if (!Number.isInteger(minorUnit) || minorUnit < 0) {
    throw new Error('prices.currency_minor_unit must be a non-negative integer');
  }

  return Number(priceStr) / Math.pow(10, minorUnit);
}

/**
 * Maps a raw WooCommerce Store API product payload to the normalized TeckAI format.
 * 
 * @param {Object} raw - Raw WooCommerce product object
 * @returns {Object} Mapped product data ready for normalization
 */
function mapProduct(raw) {
  if (!raw || raw.id === undefined || raw.id === null) {
    throw new Error('EEZEPC product ID is required for mapping identity');
  }

  // Resolve category or throw skip error
  const resolvedCategory = resolveCategory(raw.categories || []);

  // Convert price or throw validation error
  const finalPrice = convertPrice(raw.prices);

  // Map availability status
  let availability = 'unknown';
  if (raw.is_in_stock === true) {
    availability = 'in_stock';
  } else if (raw.is_in_stock === false) {
    availability = 'out_of_stock';
  }

  // Specifications flattening from attributes
  const specifications = {};
  if (Array.isArray(raw.attributes)) {
    for (const attr of raw.attributes) {
      if (attr.name && Array.isArray(attr.terms)) {
        const terms = attr.terms.map(t => t.name).filter(Boolean);
        if (terms.length > 0) {
          const specKey = attr.name.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '_');
          specifications[specKey] = terms.join(', ');
        }
      }
    }
  }

  // Extract images
  const images = [];
  if (Array.isArray(raw.images)) {
    for (const img of raw.images) {
      let src = '';
      if (typeof img === 'string') {
        src = img.trim();
      } else if (img && typeof img === 'object') {
        if (typeof img.src === 'string') src = img.src.trim();
        else if (typeof img.url === 'string') src = img.url.trim();
      }
      if (src && (src.startsWith('http://') || src.startsWith('https://')) && !src.includes('[object Object]')) {
        images.push(src);
      }
    }
  }

  let description = cleanDescription(raw.description || raw.short_description || '');
  if (!description) {
    description = cleanText(raw.name) || 'No description available.';
  }

  return {
    name: cleanText(raw.name),
    slug: raw.slug || '',
    sku: raw.sku ? String(raw.sku).trim() : '',
    description,
    price: finalPrice,
    currency: raw.prices.currency_code || 'PKR',
    brand: extractBrand(raw),
    category: resolvedCategory,
    condition: 'new',
    images,
    specifications,
    availability,
    stock: undefined, // Do not fabricate stock level
    source: {
      name: 'EEZEPC',
      listingId: String(raw.id),
      url: raw.permalink || '',
      type: 'api'
    },
    seller: {
      name: 'EEZEPC Pakistan',
      type: 'retailer'
    }
  };
}

/**
 * Checks if a string is a generic category or brand word that should never be used as a brand name.
 * 
 * @param {string} str - The string to check
 * @returns {boolean} True if generic, false otherwise
 */
function isGenericBrandOrCategory(str) {
  if (!str) return true;
  const norm = str.toLowerCase().trim();
  
  const genericTerms = new Set([
    'laptops', 'laptop', 'notebooks', 'notebook', 'gaming laptops', 'gaming laptop',
    'monitors', 'monitor', 'gaming monitors', 'gaming monitor', 'lcd monitors', 'lcd monitor', 'led', 'led monitors', 'led monitor',
    'keyboards', 'keyboard', 'gaming keyboards', 'gaming keyboard',
    'mouse', 'mice', 'gaming mouse', 'gaming mice',
    'headphones', 'headphone', 'headsets', 'headset', 'gaming headphones', 'gaming headphone', 'earphones', 'earphone',
    'speakers', 'speaker', 'audio', 'sound', 'soundbar', 'soundbars',
    'computers', 'computer', 'computer accessories', 'computer accessory', 'accessories', 'accessory', 'computer peripherals', 'computer peripheral', 'peripherals', 'peripheral',
    'mobile phones', 'mobile phone', 'smartphones', 'smartphone', 'phones', 'phone',
    'components', 'pc components', 'component', 'pc component',
    'uncategorized', 'generic', 'brands', 'brand'
  ]);

  if (genericTerms.has(norm)) {
    return true;
  }

  if (norm.includes('peripherals') || norm.includes('accessories') || norm.includes('uncategorized')) {
    return true;
  }

  return false;
}

/**
 * Extracts a trustworthy brand from the WooCommerce product payload.
 * 
 * @param {Object} raw - Raw product payload
 * @returns {string|undefined} Trustworthy brand name or undefined
 */
function extractBrand(raw) {
  if (!raw) return undefined;

  // 1. Check direct brand field (string or object)
  if (raw.brand && typeof raw.brand === 'string') {
    const b = cleanText(raw.brand);
    if (b && !isGenericBrandOrCategory(b)) return b;
  }
  if (raw.brand && typeof raw.brand === 'object' && raw.brand.name) {
    const b = cleanText(raw.brand.name);
    if (b && !isGenericBrandOrCategory(b)) return b;
  }

  // 2. Check direct brands array (if populated)
  if (Array.isArray(raw.brands) && raw.brands.length > 0) {
    const firstBrand = raw.brands[0];
    if (firstBrand && typeof firstBrand === 'string') {
      const b = cleanText(firstBrand);
      if (b && !isGenericBrandOrCategory(b)) return b;
    } else if (firstBrand && firstBrand.name) {
      const b = cleanText(firstBrand.name);
      if (b && !isGenericBrandOrCategory(b)) return b;
    }
  }

  // 3. Check WooCommerce brand/manufacturer attributes
  if (Array.isArray(raw.attributes)) {
    const brandAttr = raw.attributes.find(attr => {
      const name = (attr.name || '').toLowerCase().trim();
      return name === 'brand' || name === 'manufacturer';
    });
    if (brandAttr && Array.isArray(brandAttr.terms) && brandAttr.terms.length > 0) {
      const b = cleanText(brandAttr.terms[0].name);
      if (b && !isGenericBrandOrCategory(b)) return b;
    }
  }

  // 4. Check WooCommerce categories array for brand-specific category taxonomies
  if (Array.isArray(raw.categories)) {
    for (const cat of raw.categories) {
      const catName = cleanText(cat.name);
      if (catName && !isGenericBrandOrCategory(catName)) {
        return catName;
      }
    }
  }

  return undefined;
}

module.exports = {
  mapProduct,
  convertPrice,
  resolveCategory,
  mapSingleCategory,
  isAccessoryCategory,
  cleanText,
  cleanDescription,
  extractBrand,
  isGenericBrandOrCategory
};
