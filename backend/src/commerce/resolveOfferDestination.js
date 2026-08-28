/**
 * Helper to validate http/https URLs safely.
 * 
 * @param {string} string 
 * @returns {boolean}
 */
function isValidHttpUrl(string) {
  if (!string || typeof string !== 'string') return false;
  const trimmed = string.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Resolves the authoritative redirect destination for a ProductOffer.
 * 
 * Routing priority:
 * 1. If affiliate is enabled and affiliate.url is a valid HTTP/HTTPS URL -> affiliate destination
 * 2. Fallback to valid sourceUrl or source.url -> direct retailer destination
 * 3. If neither is available -> returns structured unavailable result (never guesses or emits arbitrary URL)
 * 
 * @param {Object} offer - ProductOffer document or object
 * @returns {{
 *   success: boolean,
 *   destinationUrl: string|null,
 *   destinationType: 'affiliate'|'source'|'none',
 *   affiliateUsed: boolean,
 *   campaign?: string,
 *   reason?: string
 * }}
 */
function resolveOfferDestination(offer = {}) {
  if (!offer || typeof offer !== 'object') {
    return {
      success: false,
      reason: 'invalid_offer',
      destinationUrl: null,
      destinationType: 'none',
      affiliateUsed: false
    };
  }

  // 1. Check affiliate destination
  const affiliate = offer.affiliate || {};
  const isAffiliateEnabled = Boolean(affiliate.enabled);
  const affiliateUrl = typeof affiliate.url === 'string' ? affiliate.url.trim() : (typeof offer.affiliateUrl === 'string' ? offer.affiliateUrl.trim() : '');

  if (isAffiliateEnabled && isValidHttpUrl(affiliateUrl)) {
    return {
      success: true,
      destinationUrl: affiliateUrl,
      destinationType: 'affiliate',
      affiliateUsed: true,
      campaign: affiliate.campaign ? String(affiliate.campaign).trim() : undefined
    };
  }

  // 2. Fallback to direct source URL
  const sourceUrl = typeof offer.sourceUrl === 'string' && offer.sourceUrl.trim() !== ''
    ? offer.sourceUrl.trim()
    : (offer.source && typeof offer.source.url === 'string' ? offer.source.url.trim() : '');

  if (isValidHttpUrl(sourceUrl)) {
    return {
      success: true,
      destinationUrl: sourceUrl,
      destinationType: 'source',
      affiliateUsed: false,
      campaign: undefined
    };
  }

  // 3. Unavailable
  return {
    success: false,
    reason: 'destination_unavailable',
    destinationUrl: null,
    destinationType: 'none',
    affiliateUsed: false
  };
}

module.exports = {
  resolveOfferDestination,
  isValidHttpUrl
};
