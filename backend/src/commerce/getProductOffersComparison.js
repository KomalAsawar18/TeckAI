const mongoose = require('mongoose');
const Category = require('../models/Category');
const CanonicalProduct = require('../models/CanonicalProduct');
const ProductOffer = require('../models/ProductOffer');
const { compareOffers } = require('./compareOffers');
const NotFoundError = require('../errors/NotFoundError');
const BadRequestError = require('../errors/BadRequestError');

/**
 * Formats an offer safely for client/public presentation.
 * Explicitly omits raw affiliate URLs and credentials, exposing only safe redirect routes.
 * 
 * @param {Object} offer 
 * @returns {Object}
 */
function sanitizePublicOffer(offer) {
  if (!offer) return null;

  const id = offer._id || offer.id;

  return {
    id: id ? String(id) : undefined,
    seller: offer.seller?.name || offer.source?.name || 'Retailer',
    source: offer.source?.name,
    price: offer.price,
    currency: offer.currency || 'PKR',
    availability: offer.availability,
    condition: offer.condition || 'new',
    variant: offer.variant ? {
      color: offer.variant.color || undefined,
      configuration: offer.variant.configuration || undefined
    } : undefined,
    redirectUrl: id ? `/api/offers/${id}/redirect` : undefined,
    lastSyncedAt: offer.lastSyncedAt
  };
}

/**
 * Loads a Canonical Product, queries associated Product Offers, and performs deterministic comparison.
 * 
 * @param {string|mongoose.Types.ObjectId} canonicalProductId - CanonicalProduct ID
 * @param {Object} [options] - Comparison & filtering options
 * @param {Object} [dependencies] - Injected models for testing
 * @returns {Promise<{
 *   product: Object,
 *   bestOffer: Object|null,
 *   offers: Array<Object>,
 *   summary: Object
 * }>}
 */
async function getProductOffersComparison(canonicalProductId, options = {}, dependencies = {}) {
  const CanonicalModel = dependencies.CanonicalProductModel || CanonicalProduct;
  const OfferModel = dependencies.ProductOfferModel || ProductOffer;

  if (!canonicalProductId || !mongoose.Types.ObjectId.isValid(String(canonicalProductId))) {
    throw new BadRequestError('Invalid canonical product ID format');
  }

  const product = await CanonicalModel.findById(canonicalProductId).populate('category', 'name slug');
  if (!product) {
    throw new NotFoundError('Canonical product not found');
  }

  // Fetch active offers for this canonical product
  const rawOffers = await OfferModel.find({
    canonicalProduct: product._id,
    isActive: true
  }).sort({ price: 1 });

  // Run pure comparison engine
  const comparison = compareOffers(rawOffers, options);

  const formattedProduct = {
    id: String(product._id),
    name: product.name,
    brand: product.brand,
    model: product.model,
    category: product.category,
    canonicalKey: product.canonicalKey,
    images: product.images || [],
    specifications: product.specifications || {}
  };

  const formattedBestOffer = sanitizePublicOffer(comparison.bestOffer);
  const formattedOffers = comparison.rankedOffers.map(sanitizePublicOffer);

  return {
    product: formattedProduct,
    bestOffer: formattedBestOffer,
    offers: formattedOffers,
    summary: comparison.summary
  };
}

module.exports = {
  getProductOffersComparison,
  sanitizePublicOffer
};
