/**
 * Czone Source Connector Mapper
 * 
 * Responsible for mapping Czone's raw HTML parse result to TeckAI's normalized contract.
 * Does NOT contain database or persistence logic.
 */

/**
 * Normalizes Czone category string to global TeckAI category.
 * 
 * @param {string} rawCategory - Raw category string
 * @returns {string|undefined} TeckAI category identifier, or undefined if unknown
 */
function mapCategory(rawCategory) {
  if (!rawCategory) return undefined;
  const cleaned = rawCategory.trim().toLowerCase();
  
  if (cleaned.includes('laptop') || cleaned.includes('notebook')) {
    return 'laptops';
  }
  if (cleaned.includes('monitor') || cleaned.includes('led') || cleaned.includes('lcd')) {
    return 'monitors';
  }
  if (cleaned.includes('keyboard')) {
    return 'keyboards';
  }
  if (cleaned.includes('mouse') || cleaned.includes('mice')) {
    return 'mouse';
  }
  if (cleaned.includes('headphone') || cleaned.includes('headset')) {
    return 'headphones';
  }
  return undefined; // fails safely
}

/**
 * Maps raw Czone scraped data into the generic object expected by normalizeProduct().
 * 
 * @param {Object} rawData - Scraped raw product details
 * @returns {Object} Un-normalized generic payload
 */
function mapProduct(rawData) {
  if (!rawData) {
    throw new Error('Raw Czone product data is required');
  }
  if (!rawData.productCode || String(rawData.productCode).trim() === '') {
    throw new Error('Czone productCode is required for mapping identity');
  }

  // Parse price from string like "Rs. 9,450" to clean number
  let price = 0;
  if (rawData.priceText) {
    const numericStr = String(rawData.priceText).replace(/[^0-9]/g, '');
    const parsedPrice = parseInt(numericStr, 10);
    if (!isNaN(parsedPrice)) {
      price = parsedPrice;
    }
  }

  // Map availability status without fabricating stock quantity
  let availability = 'unknown';
  if (rawData.availability) {
    const avail = String(rawData.availability).trim().toLowerCase();
    if (avail.includes('in stock') || avail.includes('available')) {
      availability = 'in_stock';
    } else if (avail.includes('out of stock') || avail.includes('sold out')) {
      availability = 'out_of_stock';
    }
  }

  // Map specifications keys to lowercase clean variables
  const specifications = {};
  if (rawData.features && typeof rawData.features === 'object') {
    for (const [key, value] of Object.entries(rawData.features)) {
      const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      specifications[cleanKey] = String(value).trim();
    }
  }

  // Assemble generic product structure
  const resultProduct = {
    name: rawData.title ? String(rawData.title).trim() : '',
    price: price,
    currency: 'PKR',
    brand: rawData.brandRaw ? String(rawData.brandRaw).trim() : 'Generic',
    category: mapCategory(rawData.categoryRaw),
    condition: 'new', // Czone sells brand new products
    description: rawData.title ? `${String(rawData.title).trim()} available at Computer Zone Pakistan.` : '',
    images: rawData.imageUrl ? [String(rawData.imageUrl).trim()] : [],
    specifications: specifications,
    availability: availability,
    source: {
      name: 'Czone',
      listingId: String(rawData.productCode).trim(),
      url: rawData.url ? String(rawData.url).trim() : undefined,
      type: 'scraper'
    },
    seller: {
      name: 'Computer Zone Pakistan',
      type: 'retailer'
    }
  };

  // Only pass stock if genuinely supplied as a valid number
  if (rawData.stock !== undefined && rawData.stock !== null && rawData.stock !== '') {
    const s = Number(rawData.stock);
    if (!isNaN(s)) {
      resultProduct.stock = s;
    }
  }

  // Only pass rating if genuinely supplied as a valid number
  if (rawData.rating !== undefined && rawData.rating !== null && rawData.rating !== '') {
    const r = Number(rawData.rating);
    if (!isNaN(r)) {
      resultProduct.rating = r;
    }
  }

  // Only pass reviewCount if genuinely supplied as a valid number
  if (rawData.reviewCount !== undefined && rawData.reviewCount !== null && rawData.reviewCount !== '') {
    const rc = Number(rawData.reviewCount);
    if (!isNaN(rc)) {
      resultProduct.reviewCount = rc;
    }
  }

  return resultProduct;
}

module.exports = {
  mapProduct,
  mapCategory
};
