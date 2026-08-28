const mongoose = require('mongoose');
const ProductOffer = require('../models/ProductOffer');
const OfferClick = require('../models/OfferClick');
const { resolveOfferDestination } = require('./resolveOfferDestination');

const ALLOWED_CONTEXTS = new Set([
  'product_page',
  'comparison',
  'ai_recommendation',
  'search',
  'unknown'
]);

/**
 * Validates and executes an offer redirect by:
 * 1. Validating offerId format (400 if invalid)
 * 2. Fetching the ProductOffer from database (404 if missing)
 * 3. Verifying the offer is active (410 if inactive)
 * 4. Resolving destination URL (affiliate URL or source fallback) (422 if unavailable)
 * 5. Recording an OfferClick event
 * 6. Returning the destination URL for HTTP 302 redirect
 * 
 * Open Redirect Protection:
 * - Does NOT accept arbitrary redirect URLs from client query or headers.
 * - Destination URL is strictly resolved from trusted ProductOffer database document.
 * - Enforces HTTP/HTTPS protocol validation.
 * 
 * @param {string} offerId - ProductOffer ObjectId
 * @param {Object} [options]
 * @param {string} [options.context] - Client context (product_page, search, etc.)
 * @param {Object} [options.ProductOfferModel] - Injected model for testing
 * @param {Object} [options.OfferClickModel] - Injected model for testing
 * @returns {Promise<{
 *   success: boolean,
 *   status: number,
 *   destinationUrl?: string,
 *   clickId?: Object,
 *   affiliateUsed?: boolean,
 *   destinationType?: string,
 *   error?: string
 * }>}
 */
async function redirectOffer(offerId, { context = 'unknown', ProductOfferModel = ProductOffer, OfferClickModel = OfferClick } = {}) {
  // 1. Validate ObjectId format
  if (!offerId || typeof offerId !== 'string' || !mongoose.isValidObjectId(offerId)) {
    return {
      success: false,
      status: 400,
      error: 'Invalid offer ID format'
    };
  }

  // 2. Load ProductOffer
  const offer = await ProductOfferModel.findById(offerId);
  if (!offer) {
    return {
      success: false,
      status: 404,
      error: 'Product offer not found'
    };
  }

  // 3. Verify offer is active
  if (offer.isActive === false) {
    return {
      success: false,
      status: 410,
      error: 'Offer is inactive or discontinued'
    };
  }

  // 4. Resolve destination URL (affiliate or source fallback)
  const destination = resolveOfferDestination(offer);
  if (!destination.success || !destination.destinationUrl) {
    return {
      success: false,
      status: 422,
      error: 'No valid destination URL available for this offer'
    };
  }

  // Normalize context safely
  const normContext = typeof context === 'string' ? context.toLowerCase().trim() : 'unknown';
  const safeContext = ALLOWED_CONTEXTS.has(normContext) ? normContext : 'unknown';

  // Extract sanitized destination host for analytics without persisting query strings or tokens
  let destinationHost;
  try {
    const parsedUrl = new URL(destination.destinationUrl);
    destinationHost = parsedUrl.hostname ? parsedUrl.hostname.toLowerCase() : undefined;
  } catch {
    destinationHost = undefined;
  }

  // 5. Record privacy-friendly OfferClick (minimizes data; no full destination URLs, queries, or secrets)
  const click = await OfferClickModel.create({
    offer: offer._id,
    canonicalProduct: offer.canonicalProduct,
    sellerName: offer.seller?.name || offer.source?.name,
    sourceName: offer.source?.name,
    affiliateUsed: destination.affiliateUsed,
    destinationType: destination.destinationType,
    destinationHost,
    campaign: destination.campaign,
    context: safeContext,
    clickedAt: new Date()
  });

  return {
    success: true,
    status: 302,
    destinationUrl: destination.destinationUrl,
    clickId: click._id,
    affiliateUsed: destination.affiliateUsed,
    destinationType: destination.destinationType
  };
}

module.exports = {
  redirectOffer,
  ALLOWED_CONTEXTS
};
