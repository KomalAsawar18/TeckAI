/**
 * Specific allowlists for supported categories mapped to TeckAI internal standard categories.
 */
const CATEGORY_ALLOWLIST = {
  keyboards: new Set([
    'keyboard',
    'keyboards',
    'gaming-keyboard',
    'mechanical-keyboard',
    'wireless-keyboard',
    'gaming_keyboard'
  ]),
  mouse: new Set([
    'mouse',
    'mice',
    'gaming-mouse',
    'wireless-mouse'
  ]),
  headphones: new Set([
    'headphones',
    'headphone',
    'headsets',
    'headset',
    'gaming-headsets',
    'gaming-headset',
    'earphones'
  ]),
  monitors: new Set([
    'monitors',
    'monitor',
    'gaming-monitors',
    'gaming-monitor',
    'oled-monitors'
  ]),
  laptops: new Set([
    'laptops',
    'laptop',
    'gaming-laptops',
    'gaming-laptop',
    'notebooks'
  ])
};

const ACCESSORY_SLUGS = new Set([
  'mouse-pad',
  'mouse-pads',
  'mouse-mat',
  'mouse-mats',
  'mouse-bungee',
  'mouse-accessories',
  'mouse-skates',
  'mouse-grips',
  'keyboard-accessories',
  'keycaps',
  'keycap',
  'switches',
  'switch',
  'wrist-rest',
  'wrist-rests',
  'headphone-stand',
  'headphone-stands',
  'headphone-case',
  'headphone-cases',
  'headphone-accessories',
  'audio-cables',
  'earpads',
  'monitor-arm',
  'monitor-arms',
  'monitor-mount',
  'monitor-mounts',
  'monitor-stand',
  'monitor-accessories',
  'laptop-bag',
  'laptop-bags',
  'laptop-sleeve',
  'laptop-sleeves',
  'laptop-stand',
  'laptop-stands',
  'cooling-pad',
  'cooling-pads',
  'cooling-accessories',
  'gamepads',
  'gaming-chairs',
  'gaming-desk',
  'combo-peripherals-accessories',
  'combo'
]);

/**
 * Determines whether a category slug or title belongs to accessories that must be excluded.
 * 
 * @param {string} slug 
 * @param {string} [name] 
 * @returns {boolean}
 */
function isAccessoryCategory(slug = '', name = '') {
  const normSlug = String(slug).toLowerCase().trim();
  const normName = String(name).toLowerCase().trim();

  if (ACCESSORY_SLUGS.has(normSlug)) return true;

  const accessoryKeywords = [
    'mouse pad', 'mousepad', 'mouse mat', 'mouse bungee', 'mouse skate', 'mouse grip', 'mouse feet',
    'keyboard accessory', 'keycap', 'key cap', 'switch lube', 'wrist rest',
    'headphone stand', 'headphone case', 'headphone bag', 'ear cushion', 'earpad',
    'monitor arm', 'monitor mount', 'monitor stand', 'vesa mount',
    'laptop bag', 'laptop sleeve', 'laptop stand', 'cooling pad', 'charger', 'cable', 'adapter', 'dock',
    'sleeves', 'stands', 'chargers', 'cables', 'adapters', 'docks',
    'chair', 'table', 'desk', 'controller', 'gamepad', 'joystick'
  ];

  return accessoryKeywords.some(kw => normSlug.includes(kw.replace(/\s+/g, '-')) || normName.includes(kw));
}

/**
 * Maps WooCommerce categories to supported standard TeckAI category slugs.
 * 
 * @param {Array<Object>} categories 
 * @returns {string|undefined}
 */
function mapCategory(categories = []) {
  if (!Array.isArray(categories) || categories.length === 0) return undefined;

  for (const cat of categories) {
    const slug = (cat.slug || '').toLowerCase().trim();
    const name = (cat.name || '').toLowerCase().trim();

    if (isAccessoryCategory(slug, name)) {
      continue;
    }

    for (const [targetCat, allowedSet] of Object.entries(CATEGORY_ALLOWLIST)) {
      if (allowedSet.has(slug)) {
        return targetCat;
      }
    }
  }

  return undefined;
}

/**
 * Extracts explicit brand taxonomy (pa_brand) or Brand attribute from product.
 * Does NOT infer brand from title.
 * 
 * @param {Object} rawProduct 
 * @returns {string|undefined}
 */
function extractBrand(rawProduct = {}) {
  const attributes = Array.isArray(rawProduct.attributes) ? rawProduct.attributes : [];

  for (const attr of attributes) {
    const taxonomy = (attr.taxonomy || '').toLowerCase().trim();
    const name = (attr.name || '').toLowerCase().trim();

    if (taxonomy === 'pa_brand' || name === 'pa_brand' || name === 'brand' || name === 'manufacturer') {
      if (Array.isArray(attr.terms) && attr.terms.length > 0 && attr.terms[0].name) {
        const brandName = String(attr.terms[0].name).trim();
        if (brandName) return brandName;
      }
      if (Array.isArray(attr.options) && attr.options.length > 0) {
        const brandOption = String(attr.options[0]).trim();
        if (brandOption) return brandOption;
      }
      if (typeof attr.value === 'string' && attr.value.trim().length > 0) {
        return attr.value.trim();
      }
    }
  }

  return undefined;
}

/**
 * Extracts explicit model/MPN from product attributes only.
 * Does NOT assume SKU is model.
 * 
 * @param {Object} rawProduct 
 * @returns {string|undefined}
 */
function extractModel(rawProduct = {}) {
  const attributes = Array.isArray(rawProduct.attributes) ? rawProduct.attributes : [];

  for (const attr of attributes) {
    const name = (attr.name || '').toLowerCase().trim();
    const taxonomy = (attr.taxonomy || '').toLowerCase().trim();

    if (name === 'model' || name === 'model number' || name === 'mpn' || taxonomy === 'pa_model' || taxonomy === 'pa_mpn') {
      if (Array.isArray(attr.terms) && attr.terms.length > 0 && attr.terms[0].name) {
        return String(attr.terms[0].name).trim();
      }
      if (Array.isArray(attr.options) && attr.options.length > 0) {
        return String(attr.options[0]).trim();
      }
      if (typeof attr.value === 'string' && attr.value.trim().length > 0) {
        return attr.value.trim();
      }
    }
  }

  return undefined;
}

/**
 * Converts price respecting currency_minor_unit.
 * 
 * @param {Object} pricesObj 
 * @returns {{ price: number|undefined, currency: string }}
 */
function extractPriceAndCurrency(pricesObj = {}) {
  const currency = pricesObj.currency_code ? String(pricesObj.currency_code).trim().toUpperCase() : 'PKR';
  const minorUnit = typeof pricesObj.currency_minor_unit === 'number' ? pricesObj.currency_minor_unit : 0;

  const rawVal = pricesObj.price || pricesObj.regular_price || pricesObj.sale_price;
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return { price: undefined, currency };
  }

  const numVal = parseFloat(rawVal);
  if (Number.isNaN(numVal) || numVal < 0) {
    return { price: undefined, currency };
  }

  const scaledPrice = minorUnit > 0 ? numVal / Math.pow(10, minorUnit) : numVal;
  return {
    price: Math.round(scaledPrice),
    currency
  };
}

/**
 * Converts attributes into a structured specifications dictionary.
 * 
 * @param {Array<Object>} attributes 
 * @returns {Object}
 */
function extractSpecifications(attributes = []) {
  const specs = {};
  if (!Array.isArray(attributes)) return specs;

  for (const attr of attributes) {
    const key = (attr.name || attr.taxonomy || '').trim();
    if (!key) continue;

    let value = '';
    if (Array.isArray(attr.terms) && attr.terms.length > 0) {
      value = attr.terms.map(t => t.name).join(', ');
    } else if (Array.isArray(attr.options) && attr.options.length > 0) {
      value = attr.options.join(', ');
    } else if (attr.value) {
      value = String(attr.value);
    }

    if (value) {
      const sanitizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      specs[sanitizedKey] = value.trim();
    }
  }

  return specs;
}

/**
 * Maps a raw WooCommerce Store API product item to TeckAI's normalized product representation.
 * 
 * @param {Object} rawProduct 
 * @returns {Object} Normalized product payload
 */
function mapInfinityProduct(rawProduct = {}) {
  if (!rawProduct || typeof rawProduct !== 'object') {
    throw new Error('Raw Infinity Store product must be an object');
  }

  const listingId = String(rawProduct.id || '').trim();
  if (!listingId) {
    throw new Error('Infinity Store product missing required id');
  }

  const name = String(rawProduct.name || '')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, '’')
    .replace(/&#215;/g, '×')
    .replace(/&amp;/g, '&')
    .trim();

  if (!name) {
    throw new Error('Infinity Store product missing name');
  }

  const category = mapCategory(rawProduct.categories);
  const brand = extractBrand(rawProduct);
  const model = extractModel(rawProduct);
  const { price, currency } = extractPriceAndCurrency(rawProduct.prices);
  const specifications = extractSpecifications(rawProduct.attributes);

  const images = (Array.isArray(rawProduct.images) ? rawProduct.images : [])
    .map((img, idx) => {
      let src = '';
      if (typeof img === 'string') {
        src = img.trim();
      } else if (img && typeof img === 'object') {
        if (typeof img.src === 'string') src = img.src.trim();
        else if (typeof img.url === 'string') src = img.url.trim();
      }
      return {
        url: src,
        isPrimary: idx === 0
      };
    })
    .filter(img => img.url && (img.url.startsWith('http://') || img.url.startsWith('https://')) && !img.url.includes('[object Object]'));

  const availability = rawProduct.is_in_stock === true
    ? 'in_stock'
    : (rawProduct.is_in_stock === false ? 'out_of_stock' : 'unknown');

  const sourceUrl = (rawProduct.permalink || '').trim();

  return {
    name,
    brand: brand || undefined,
    model: model || undefined,
    sku: (rawProduct.sku || '').trim() || undefined,
    category: category || undefined,
    price,
    currency,
    availability,
    sourceUrl,
    images,
    specifications,
    description: (rawProduct.short_description || rawProduct.description || '').trim(),
    source: {
      name: 'INFINITY_STORE',
      listingId,
      url: sourceUrl,
      type: 'api',
      lastSyncedAt: new Date()
    },
    seller: {
      name: 'Infinity Store Pakistan',
      type: 'retailer'
    },
    affiliate: {
      enabled: false
    }
  };
}

module.exports = {
  mapInfinityProduct,
  mapCategory,
  extractBrand,
  extractModel,
  extractPriceAndCurrency,
  extractSpecifications,
  isAccessoryCategory,
  CATEGORY_ALLOWLIST
};
