const AVAILABILITY_RANKS = {
  in_stock: 0,
  unknown: 1,
  pre_order: 2,
  out_of_stock: 3
};

const CONDITION_RANKS = {
  new: 0,
  refurbished: 1,
  open_box: 2,
  used: 3
};

/**
 * Pure, deterministic comparison and ranking engine for ProductOffers.
 * 
 * @param {Array<Object>} offers - Raw or Mongoose ProductOffer documents
 * @param {Object} [options]
 * @param {string} [options.targetCurrency='PKR'] - Target comparison currency
 * @param {string} [options.condition] - Exact condition filter ('new', 'refurbished', etc.)
 * @param {Array<string>} [options.allowedConditions] - Allowed condition list
 * @param {string} [options.color] - Variant color filter
 * @param {string} [options.configuration] - Variant configuration filter
 * @param {boolean} [options.includeUnavailable=false] - Allow out_of_stock offers as bestOffer
 * @returns {{
 *   bestOffer: Object|null,
 *   rankedOffers: Array<Object>,
 *   excludedOffers: Array<{ offer: Object, reason: string }>,
 *   summary: {
 *     totalOffers: number,
 *     eligibleOffers: number,
 *     excludedOffers: number,
 *     bestPrice: number|null,
 *     currency: string,
 *     sellerCount: number,
 *     sourceCount: number
 *   }
 * }}
 */
function compareOffers(offers = [], options = {}) {
  const targetCurrency = (options.targetCurrency || 'PKR').toUpperCase().trim();
  const includeUnavailable = Boolean(options.includeUnavailable);
  const colorFilter = options.color ? String(options.color).trim().toLowerCase() : null;
  const configFilter = options.configuration ? String(options.configuration).trim().toLowerCase() : null;
  const conditionFilter = options.condition ? String(options.condition).trim().toLowerCase() : null;
  const allowedConditions = Array.isArray(options.allowedConditions)
    ? options.allowedConditions.map(c => String(c).trim().toLowerCase())
    : null;

  const eligible = [];
  const excludedOffers = [];

  const rawOffers = Array.isArray(offers) ? offers : [];

  for (const raw of rawOffers) {
    // Normalization helper for plain objects or Mongoose docs
    const offer = raw && typeof raw.toObject === 'function' ? raw.toObject() : { ...raw };

    // 1. Active check
    if (offer.isActive === false) {
      excludedOffers.push({ offer, reason: 'inactive' });
      continue;
    }

    // 2. Valid numeric price check
    if (offer.price === undefined || offer.price === null || isNaN(Number(offer.price)) || Number(offer.price) < 0) {
      excludedOffers.push({ offer, reason: 'invalid_price' });
      continue;
    }
    offer.price = Number(offer.price);

    // 3. Currency check (TeckAI Step 3E: single target currency, no FX conversion yet)
    const offerCurrency = (offer.currency || 'PKR').toUpperCase().trim();
    if (offerCurrency !== targetCurrency) {
      excludedOffers.push({
        offer,
        reason: 'currency_mismatch',
        details: `Expected ${targetCurrency}, got ${offerCurrency}`
      });
      continue;
    }

    // 4. Destination / source metadata validation
    const sourceUrl = offer.sourceUrl || offer.source?.url;
    if (!sourceUrl || typeof sourceUrl !== 'string' || (!sourceUrl.startsWith('http://') && !sourceUrl.startsWith('https://'))) {
      excludedOffers.push({ offer, reason: 'missing_destination' });
      continue;
    }

    // 5. Condition filter check
    const offerCondition = (offer.condition || 'new').toLowerCase().trim();
    if (conditionFilter && offerCondition !== conditionFilter) {
      excludedOffers.push({ offer, reason: 'condition_mismatch' });
      continue;
    }
    if (allowedConditions && !allowedConditions.includes(offerCondition)) {
      excludedOffers.push({ offer, reason: 'condition_not_allowed' });
      continue;
    }

    // 6. Variant filters check
    if (colorFilter) {
      const offerColor = (offer.variant?.color || '').toLowerCase().trim();
      if (!offerColor || (!offerColor.includes(colorFilter) && !colorFilter.includes(offerColor))) {
        excludedOffers.push({ offer, reason: 'variant_mismatch' });
        continue;
      }
    }

    if (configFilter) {
      const offerConfig = (offer.variant?.configuration || '').toLowerCase().trim();
      if (!offerConfig || (!offerConfig.includes(configFilter) && !configFilter.includes(offerConfig))) {
        excludedOffers.push({ offer, reason: 'variant_mismatch' });
        continue;
      }
    }

    eligible.push(offer);
  }

  // Deterministic sorting / ranking
  eligible.sort((a, b) => {
    // 1. Availability Rank (in_stock=0, unknown=1, pre_order=2, out_of_stock=3)
    const availA = AVAILABILITY_RANKS[a.availability] !== undefined ? AVAILABILITY_RANKS[a.availability] : 1;
    const availB = AVAILABILITY_RANKS[b.availability] !== undefined ? AVAILABILITY_RANKS[b.availability] : 1;
    if (availA !== availB) {
      return availA - availB;
    }

    // 2. Condition Rank (new=0, refurbished=1, open_box=2, used=3)
    const condA = CONDITION_RANKS[a.condition] !== undefined ? CONDITION_RANKS[a.condition] : 0;
    const condB = CONDITION_RANKS[b.condition] !== undefined ? CONDITION_RANKS[b.condition] : 0;
    if (condA !== condB) {
      return condA - condB;
    }

    // 3. Lower Price (ascending)
    if (a.price !== b.price) {
      return a.price - b.price;
    }

    // 4. Recency: latest lastSyncedAt (descending)
    const timeA = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
    const timeB = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }

    // 5. Stable identifier tie-breaker (source.name + listingId + _id)
    const stableIdA = `${a.source?.name || ''}:${a.source?.listingId || ''}:${a._id || a.id || ''}`;
    const stableIdB = `${b.source?.name || ''}:${b.source?.listingId || ''}:${b._id || b.id || ''}`;
    return stableIdA.localeCompare(stableIdB);
  });

  // Best offer selection
  let bestOffer = null;
  if (eligible.length > 0) {
    const topCandidate = eligible[0];
    const isOutOfStock = topCandidate.availability === 'out_of_stock';

    if (!isOutOfStock || includeUnavailable) {
      bestOffer = topCandidate;
    }
  }

  // Summary derivation
  const uniqueSellers = new Set(
    eligible.map(o => o.seller?.name || o.source?.name).filter(Boolean)
  );
  const uniqueSources = new Set(
    eligible.map(o => o.source?.name).filter(Boolean)
  );

  const summary = {
    totalOffers: rawOffers.length,
    eligibleOffers: eligible.length,
    excludedOffers: excludedOffers.length,
    bestPrice: bestOffer ? bestOffer.price : null,
    currency: targetCurrency,
    sellerCount: uniqueSellers.size,
    sourceCount: uniqueSources.size
  };

  return {
    bestOffer,
    rankedOffers: eligible,
    excludedOffers,
    summary
  };
}

module.exports = {
  compareOffers,
  AVAILABILITY_RANKS,
  CONDITION_RANKS
};
