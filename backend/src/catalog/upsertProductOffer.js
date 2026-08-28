const ProductOffer = require('../models/ProductOffer');

/**
 * Upserts a ProductOffer based on unique external identity (source.name + source.listingId).
 * 
 * Behavior:
 * - First run: creates new ProductOffer (operation: 'created')
 * - Subsequent run: updates dynamic offer fields conservatively without overwriting
 *   valid data with undefined (operation: 'updated')
 * - Refreshes lastSyncedAt
 * 
 * @param {Object} offerData - Validated offer payload
 * @param {Object} [options]
 * @param {Object} [options.ProductOfferModel] - Injected model for testing
 * @returns {Promise<{ offer: Object, operation: 'created'|'updated' }>}
 */
async function upsertProductOffer(offerData = {}, options = {}) {
  const Model = options.ProductOfferModel || ProductOffer;

  if (!offerData || typeof offerData !== 'object') {
    throw new Error('Offer data is required for upsert');
  }

  if (!offerData.canonicalProduct) {
    throw new Error('canonicalProduct ID reference is required for ProductOffer');
  }

  const sourceName = offerData.source && offerData.source.name ? String(offerData.source.name).trim() : null;
  const sourceListingId = offerData.source && offerData.source.listingId ? String(offerData.source.listingId).trim() : null;

  if (!sourceName || !sourceListingId) {
    throw new Error('source.name and source.listingId are required to identify ProductOffer');
  }

  if (offerData.price === undefined || offerData.price === null || isNaN(Number(offerData.price))) {
    throw new Error('Valid numeric price is required for ProductOffer');
  }

  // Find existing offer by external identity
  const existing = await Model.findOne({
    'source.name': sourceName,
    'source.listingId': sourceListingId
  });

  const now = offerData.lastSyncedAt instanceof Date ? offerData.lastSyncedAt : new Date();

  if (!existing) {
    const created = await Model.create({
      canonicalProduct: offerData.canonicalProduct,
      seller: offerData.seller || { name: sourceName, type: 'retailer' },
      source: {
        name: sourceName,
        listingId: sourceListingId,
        url: offerData.source?.url || offerData.sourceUrl || '',
        type: offerData.source?.type || 'api'
      },
      variant: offerData.variant || undefined,
      price: Number(offerData.price),
      currency: offerData.currency || 'PKR',
      availability: offerData.availability || 'unknown',
      stock: offerData.stock !== undefined ? offerData.stock : undefined,
      condition: offerData.condition || 'new',
      sourceUrl: offerData.sourceUrl || offerData.source?.url || '',
      affiliateUrl: offerData.affiliateUrl || undefined,
      affiliate: (offerData.affiliate && (offerData.affiliate.url || offerData.affiliate.network || offerData.affiliate.enabled)) ? {
        enabled: Boolean(offerData.affiliate.enabled),
        url: offerData.affiliate.url || undefined,
        network: offerData.affiliate.network || undefined,
        program: offerData.affiliate.program || undefined,
        campaign: offerData.affiliate.campaign || undefined,
        lastVerifiedAt: offerData.affiliate.lastVerifiedAt || undefined
      } : { enabled: false },
      lastSyncedAt: now,
      isActive: offerData.isActive !== undefined ? Boolean(offerData.isActive) : true
    });

    return {
      offer: created,
      operation: 'created'
    };
  }

  // Update dynamic fields conservatively
  existing.canonicalProduct = offerData.canonicalProduct;
  existing.price = Number(offerData.price);

  if (offerData.currency) existing.currency = offerData.currency;
  if (offerData.availability) existing.availability = offerData.availability;
  if (offerData.stock !== undefined) existing.stock = offerData.stock;
  if (offerData.condition) existing.condition = offerData.condition;
  if (offerData.variant) existing.variant = offerData.variant;

  if (offerData.sourceUrl) existing.sourceUrl = offerData.sourceUrl;
  if (offerData.affiliateUrl) existing.affiliateUrl = offerData.affiliateUrl;

  // Affiliate updates only when explicitly provided with actual config in offerData
  if (offerData.affiliate && typeof offerData.affiliate === 'object' && (offerData.affiliate.url || offerData.affiliate.network || offerData.affiliate.program || offerData.affiliate.campaign)) {
    existing.affiliate = existing.affiliate || { enabled: false };
    if (offerData.affiliate.enabled !== undefined) existing.affiliate.enabled = Boolean(offerData.affiliate.enabled);
    if (offerData.affiliate.url !== undefined) existing.affiliate.url = offerData.affiliate.url;
    if (offerData.affiliate.network !== undefined) existing.affiliate.network = offerData.affiliate.network;
    if (offerData.affiliate.program !== undefined) existing.affiliate.program = offerData.affiliate.program;
    if (offerData.affiliate.campaign !== undefined) existing.affiliate.campaign = offerData.affiliate.campaign;
    if (offerData.affiliate.lastVerifiedAt !== undefined) existing.affiliate.lastVerifiedAt = offerData.affiliate.lastVerifiedAt;
  }

  if (offerData.source) {
    if (offerData.source.url) existing.source.url = offerData.source.url;
    if (offerData.source.type) existing.source.type = offerData.source.type;
  }

  if (offerData.seller) {
    if (offerData.seller.name) existing.seller.name = offerData.seller.name;
    if (offerData.seller.type) existing.seller.type = offerData.seller.type;
    if (offerData.seller.location) existing.seller.location = offerData.seller.location;
  }

  if (offerData.isActive !== undefined) {
    existing.isActive = Boolean(offerData.isActive);
  }

  existing.lastSyncedAt = now;

  await existing.save();

  return {
    offer: existing,
    operation: 'updated'
  };
}

module.exports = { upsertProductOffer };
