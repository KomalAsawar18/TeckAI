/**
 * Czone Source Connector Mapper
 * 
 * Responsible for mapping Czone's raw HTML parse result to TeckAI's normalized contract.
 * Does NOT contain database or persistence logic.
 */

// Category mapping lookup
const CATEGORY_MAP = {
  'laptops': 'laptops',
  'laptops-notebooks': 'laptops',
  'gaming-laptops': 'laptops',
  
  'monitors': 'monitors',
  'led-lcd-monitors': 'monitors',
  'gaming-monitors': 'monitors',
  
  'keyboards': 'keyboards',
  'gaming-keyboards': 'keyboards',
  
  'mouse': 'mouse',
  'gaming-mouse': 'mouse',
  
  'headphones': 'headphones',
  'headphones-headsets': 'headphones',
  'gaming-headphones': 'headphones'
};

/**
 * Normalizes Czone category slug to global TeckAI category.
 * 
 * @param {string} rawCategory - Raw category string
 * @returns {string} TeckAI category identifier
 */
function mapCategory(rawCategory) {
  if (!rawCategory) return 'laptops'; // fallback
  const cleaned = rawCategory.trim().toLowerCase().replace(/\s+/g, '-');
  return CATEGORY_MAP[cleaned] || 'laptops';
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

  // Map stock availability
  let stock = 0;
  if (rawData.availability) {
    const avail = String(rawData.availability).trim().toLowerCase();
    if (avail.includes('in stock') || avail.includes('available')) {
      stock = 10; // Positive fallback
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
  return {
    name: rawData.title ? String(rawData.title).trim() : '',
    price: price,
    brand: rawData.brandRaw ? String(rawData.brandRaw).trim() : 'Generic',
    category: mapCategory(rawData.categoryRaw),
    condition: 'new', // Czone is a retail outlet selling brand new products
    description: rawData.title ? `${String(rawData.title).trim()} available at Computer Zone Pakistan.` : '',
    images: rawData.imageUrl ? [String(rawData.imageUrl).trim()] : [],
    specifications: specifications,
    stock: stock,
    source: {
      name: 'Czone',
      listingId: String(rawData.productCode).trim(),
      url: rawData.url ? String(rawData.url).trim() : undefined,
      type: 'scraper'
    },
    seller: {
      name: 'Computer Zone Pakistan',
      type: 'retailer',
      location: 'Karachi'
    }
  };
}

module.exports = {
  mapProduct,
  mapCategory
};
