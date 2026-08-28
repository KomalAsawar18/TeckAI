const { generateCanonicalKey } = require('../canonicalKey');
const { extractCorroboratedModel } = require('../corroborateModel');
const {
  sanitizeImages,
  deriveCanonicalName,
  filterCanonicalSpecifications,
  extractOfferVariant
} = require('../deriveCanonicalFacts');

/**
 * Extracts trustworthy model identifier following strict hierarchy:
 * 1. Explicit Model structured attribute
 * 2. Explicit MPN structured attribute
 * 3. Corroborated Title + SKU model token
 * 4. Otherwise null
 * 
 * @param {Object} product - Normalized or mapped Infinity Store product
 * @returns {{
 *   model: string|null,
 *   modelIdentitySource: 'explicit_attribute'|'title_sku_corroborated'|null,
 *   identityConfidence: 'high'|'none'
 * }}
 */
function extractTrustworthyModel(product) {
  if (!product || typeof product !== 'object') {
    return {
      model: null,
      modelIdentitySource: null,
      identityConfidence: 'none'
    };
  }

  return extractCorroboratedModel({
    brand: product.brand,
    model: product.model,
    title: product.name,
    sku: product.sku || product.specifications?.sku,
    specifications: product.specifications,
    attributes: product.attributes
  });
}

/**
 * Adapts an Infinity Store normalized product into separated Canonical Product candidate data and Product Offer data.
 * 
 * @param {Object} infinityProduct - Mapped/normalized Infinity Store product payload
 * @param {Object} [options]
 * @param {string|Object} [options.categoryId] - Resolved Category ObjectId
 * @returns {{
 *   isMatchable: boolean,
 *   reason?: string,
 *   modelIdentitySource?: string|null,
 *   identityConfidence?: string,
 *   candidateCanonical: Object,
 *   offer: Object
 * }}
 */
function adaptInfinityToCanonicalAndOffer(infinityProduct = {}, options = {}) {
  if (!infinityProduct || typeof infinityProduct !== 'object') {
    throw new Error('Infinity Store product data is required for adaptation');
  }

  const brand = infinityProduct.brand ? String(infinityProduct.brand).trim() : null;
  const modelEvidence = extractTrustworthyModel(infinityProduct);
  const model = modelEvidence.model;
  const canonicalKey = (brand && model) ? generateCanonicalKey({ brand, model }) : null;

  const category = options.categoryId || infinityProduct.category;

  const variant = extractOfferVariant(infinityProduct);
  const canonicalName = deriveCanonicalName({
    name: infinityProduct.name,
    brand,
    model,
    color: variant.color
  });

  const canonicalSpecs = filterCanonicalSpecifications(infinityProduct.specifications);
  const canonicalImages = sanitizeImages(infinityProduct.images);

  // Candidate Canonical Product (Base physical device facts)
  const candidateCanonical = {
    name: canonicalName || infinityProduct.name,
    brand: brand || undefined,
    model: model || undefined,
    category,
    description: infinityProduct.description,
    images: canonicalImages,
    specifications: canonicalSpecs,
    canonicalKey: canonicalKey || undefined,
    isActive: infinityProduct.isActive !== undefined ? Boolean(infinityProduct.isActive) : true
  };

  // Candidate Product Offer (Seller listing facts)
  const sourceName = (infinityProduct.source && infinityProduct.source.name) || 'INFINITY_STORE';
  const listingId = (infinityProduct.source && infinityProduct.source.listingId) || String(infinityProduct.id || '');
  const sourceUrl = (infinityProduct.source && infinityProduct.source.url) || infinityProduct.sourceUrl || '';

  const seller = infinityProduct.seller ? {
    name: infinityProduct.seller.name || 'Infinity Store Pakistan',
    type: infinityProduct.seller.type || 'retailer',
    location: infinityProduct.seller.location || undefined
  } : {
    name: 'Infinity Store Pakistan',
    type: 'retailer'
  };

  const offer = {
    seller,
    source: {
      name: sourceName,
      listingId: String(listingId),
      url: sourceUrl,
      type: (infinityProduct.source && infinityProduct.source.type) || 'api'
    },
    variant: (variant.color || variant.configuration) ? variant : undefined,
    price: infinityProduct.price,
    currency: infinityProduct.currency || 'PKR',
    availability: infinityProduct.availability || 'unknown',
    stock: infinityProduct.stock !== undefined ? infinityProduct.stock : undefined, // do not fabricate stock
    condition: infinityProduct.condition || 'new',
    sourceUrl,
    lastSyncedAt: (infinityProduct.source && infinityProduct.source.lastSyncedAt) || new Date(),
    isActive: infinityProduct.isActive !== undefined ? Boolean(infinityProduct.isActive) : true,
    affiliate: {
      enabled: false
    }
  };

  if (!canonicalKey) {
    return {
      isMatchable: false,
      reason: !brand ? 'missing_trustworthy_brand' : 'insufficient_model_identity',
      modelIdentitySource: modelEvidence.modelIdentitySource,
      identityConfidence: modelEvidence.identityConfidence,
      candidateCanonical,
      offer
    };
  }

  return {
    isMatchable: true,
    modelIdentitySource: modelEvidence.modelIdentitySource,
    identityConfidence: modelEvidence.identityConfidence,
    candidateCanonical,
    offer
  };
}

module.exports = {
  extractTrustworthyModel,
  adaptInfinityToCanonicalAndOffer
};
