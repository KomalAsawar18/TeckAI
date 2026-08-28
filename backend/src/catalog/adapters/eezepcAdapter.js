const { generateCanonicalKey } = require('../canonicalKey');
const {
  sanitizeImages,
  deriveCanonicalName,
  filterCanonicalSpecifications,
  extractOfferVariant
} = require('../deriveCanonicalFacts');

/**
 * Extracts a trustworthy model identifier from an EEZEPC product if genuinely present.
 * Does NOT guess or parse unverified words from the product title.
 * 
 * @param {Object} product - Normalized or mapped EEZEPC product
 * @returns {string|null} Trustworthy model or null
 */
function extractTrustworthyModel(product) {
  if (!product) return null;

  // 1. Check explicit model field
  if (product.model && typeof product.model === 'string' && product.model.trim().length > 0) {
    return product.model.trim();
  }

  // 2. Check specifications dictionary
  if (product.specifications && typeof product.specifications === 'object') {
    const specs = product.specifications;
    const candidates = [
      specs.model,
      specs.model_number,
      specs.model_no,
      specs.part_number,
      specs.mpn,
      specs.item_model_number
    ];

    for (const val of candidates) {
      if (typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
    }
  }

  // 3. Check SKU — EEZEPC maps SKU = manufacturer part number / model for laptops & peripherals
  //    e.g. "HP 15-FD0154wm", "T26H4", "Dell 16 DC16251" — these are trustworthy structured ids
  if (product.sku && typeof product.sku === 'string' && product.sku.trim().length >= 3) {
    const skuVal = product.sku.trim();
    // Reject pure numeric SKUs (these are WooCommerce internal IDs, not manufacturer part numbers)
    if (!/^\d+$/.test(skuVal)) {
      return skuVal;
    }
  }

  // If no explicit manufacturer model attribute exists, do not guess
  return null;
}

/**
 * Adapts an EEZEPC product into separated Canonical Product candidate data and Product Offer data.
 * 
 * @param {Object} eezepcProduct - Mapped/normalized EEZEPC product payload
 * @param {Object} [options]
 * @param {string|Object} [options.categoryId] - Resolved Category ObjectId
 * @returns {{
 *   isMatchable: boolean,
 *   reason?: string,
 *   candidateCanonical: Object|null,
 *   offer: Object
 * }}
 */
function adaptEezepcToCanonicalAndOffer(eezepcProduct = {}, options = {}) {
  if (!eezepcProduct || typeof eezepcProduct !== 'object') {
    throw new Error('EEZEPC product data is required for adaptation');
  }

  const brand = eezepcProduct.brand ? String(eezepcProduct.brand).trim() : null;
  const model = extractTrustworthyModel(eezepcProduct);
  const canonicalKey = (brand && model) ? generateCanonicalKey({ brand, model }) : null;

  const category = options.categoryId || eezepcProduct.category;

  const variant = extractOfferVariant(eezepcProduct);
  const canonicalName = deriveCanonicalName({
    name: eezepcProduct.name,
    brand,
    model,
    color: variant.color
  });

  const canonicalSpecs = filterCanonicalSpecifications(eezepcProduct.specifications);
  const canonicalImages = sanitizeImages(eezepcProduct.images);

  // Build candidate Canonical Product (product facts)
  const candidateCanonical = {
    name: canonicalName || eezepcProduct.name,
    brand: brand || undefined,
    model: model || undefined,
    category,
    description: eezepcProduct.description,
    images: canonicalImages,
    specifications: canonicalSpecs,
    canonicalKey: canonicalKey || undefined,
    isActive: eezepcProduct.isActive !== undefined ? Boolean(eezepcProduct.isActive) : true
  };

  // Build candidate Product Offer (seller dynamic facts)
  const sourceName = (eezepcProduct.source && eezepcProduct.source.name) || 'EEZEPC';
  const listingId = (eezepcProduct.source && eezepcProduct.source.listingId) || String(eezepcProduct.id || '');
  const sourceUrl = (eezepcProduct.source && eezepcProduct.source.url) || eezepcProduct.sourceUrl || '';

  const seller = eezepcProduct.seller ? {
    name: eezepcProduct.seller.name || 'EEZEPC Pakistan',
    type: eezepcProduct.seller.type || 'retailer',
    location: eezepcProduct.seller.location || undefined
  } : {
    name: 'EEZEPC Pakistan',
    type: 'retailer'
  };

  const offer = {
    seller,
    source: {
      name: sourceName,
      listingId: String(listingId),
      url: sourceUrl,
      type: (eezepcProduct.source && eezepcProduct.source.type) || 'api'
    },
    variant: (variant.color || variant.configuration) ? variant : undefined,
    price: eezepcProduct.price,
    currency: eezepcProduct.currency || 'PKR',
    availability: eezepcProduct.availability || 'unknown',
    stock: eezepcProduct.stock !== undefined ? eezepcProduct.stock : undefined, // do not fabricate stock
    condition: eezepcProduct.condition || 'new',
    sourceUrl,
    lastSyncedAt: (eezepcProduct.source && eezepcProduct.source.lastSyncedAt) || new Date(),
    isActive: eezepcProduct.isActive !== undefined ? Boolean(eezepcProduct.isActive) : true
  };

  if (!canonicalKey) {
    return {
      isMatchable: false,
      reason: !brand ? 'missing_trustworthy_brand' : 'insufficient_model_identity',
      candidateCanonical,
      offer
    };
  }

  return {
    isMatchable: true,
    candidateCanonical,
    offer
  };
}

module.exports = {
  extractTrustworthyModel,
  adaptEezepcToCanonicalAndOffer
};
