const mongoose = require('mongoose');
const CanonicalProduct = require('../models/CanonicalProduct');
const Category = require('../models/Category');
const { adaptEezepcToCanonicalAndOffer } = require('./adapters/eezepcAdapter');
const { adaptInfinityToCanonicalAndOffer } = require('./adapters/infinityAdapter');
const { matchCanonicalProduct } = require('./matchCanonicalProduct');
const { upsertProductOffer } = require('./upsertProductOffer');

/**
 * Resolves a Category ObjectId from an ObjectId string, Category instance, or slug.
 * 
 * @param {string|mongoose.Types.ObjectId|Object} categoryInput 
 * @returns {Promise<mongoose.Types.ObjectId|null>}
 */
async function resolveCategoryDocId(categoryInput) {
  if (!categoryInput) return null;

  if (categoryInput instanceof mongoose.Types.ObjectId) {
    return categoryInput;
  }

  if (typeof categoryInput === 'string' && mongoose.isValidObjectId(categoryInput)) {
    return new mongoose.Types.ObjectId(categoryInput);
  }

  if (typeof categoryInput === 'string') {
    const found = await Category.findOne({
      $or: [
        { slug: categoryInput.toLowerCase().trim() },
        { name: new RegExp(`^${categoryInput.trim()}$`, 'i') }
      ]
    });
    return found ? found._id : null;
  }

  if (categoryInput._id && mongoose.isValidObjectId(categoryInput._id)) {
    return categoryInput._id;
  }

  return null;
}

/**
 * Canonicalizes an external normalized listing and persists its ProductOffer.
 * 
 * Strict architectural rule:
 * If a listing lacks trustworthy manufacturer/model identity, it will NOT
 * create a CanonicalProduct or an orphan ProductOffer. It returns a structured
 * 'insufficient_identity' skip result.
 * 
 * @param {Object} listing - Normalized external product listing
 * @param {Object} [options]
 * @param {Function} [options.adapter] - Custom adapter function
 * @param {Object} [options.CanonicalProductModel]
 * @param {Object} [options.ProductOfferModel]
 * @param {Object} [options.CategoryModel]
 * @returns {Promise<{
 *   success: boolean,
 *   reason?: string,
 *   canonicalOperation?: 'created'|'reused',
 *   offerOperation?: 'created'|'updated',
 *   canonicalProductId?: Object,
 *   offerId?: Object,
 *   canonicalKey?: string
 * }>}
 */
async function canonicalizeListing(listing = {}, options = {}) {
  if (!listing || typeof listing !== 'object') {
    return {
      success: false,
      reason: 'invalid_listing'
    };
  }

  // 1. Adapter resolution based on options or source name
  let adapted;
  if (typeof options.adapter === 'function') {
    adapted = options.adapter(listing);
  } else if (listing.source && listing.source.name === 'INFINITY_STORE') {
    adapted = adaptInfinityToCanonicalAndOffer(listing);
  } else {
    adapted = adaptEezepcToCanonicalAndOffer(listing);
  }

  // 2. Reject listings without trustworthy identity
  if (!adapted.isMatchable || !adapted.candidateCanonical || !adapted.candidateCanonical.canonicalKey) {
    return {
      success: false,
      reason: adapted.reason || 'insufficient_identity',
      matchable: false
    };
  }

  const CanonicalModel = options.CanonicalProductModel || CanonicalProduct;

  // 3. Resolve category ObjectId
  const categoryId = await resolveCategoryDocId(listing.category || adapted.candidateCanonical.category);
  if (!categoryId) {
    return {
      success: false,
      reason: 'unresolved_category',
      matchable: true
    };
  }
  const originalCategoryStr = typeof listing.category === 'string' ? listing.category : (typeof adapted.candidateCanonical.category === 'string' ? adapted.candidateCanonical.category : '');
  
  adapted.candidateCanonical.category = categoryId;

  if (originalCategoryStr.toLowerCase().trim() === 'headphones') {
    const { classifyAudioSubtype } = require('./deriveCanonicalFacts');
    const subtype = classifyAudioSubtype(adapted.candidateCanonical.name, adapted.candidateCanonical.specifications);
    if (subtype !== 'unknown') {
      adapted.candidateCanonical.specifications = adapted.candidateCanonical.specifications || {};
      adapted.candidateCanonical.specifications.audioSubtype = subtype;
    }
  }
  // 4. Deterministic CanonicalProduct lookup
  const matchResult = await matchCanonicalProduct(adapted.candidateCanonical, {
    CanonicalProductModel: CanonicalModel
  });

  let canonicalProduct;
  let canonicalOperation;

  if (matchResult.match) {
    canonicalProduct = matchResult.match;
    canonicalOperation = 'reused';

    // Conservative enrichment: populate missing stable facts only without destructive overwrite
    let isModified = false;

    // 1. Name: if existing name has variant suffix and candidate has clean base name
    const existingName = canonicalProduct.name || '';
    const cleanerName = adapted.candidateCanonical.name || '';
    if (cleanerName && cleanerName.length < existingName.length && existingName.startsWith(cleanerName)) {
      canonicalProduct.name = cleanerName;
      isModified = true;
    }

    if (!canonicalProduct.description && adapted.candidateCanonical.description) {
      canonicalProduct.description = adapted.candidateCanonical.description;
      isModified = true;
    }

    // 2. Images: ensure only clean URL strings without [object Object]
    const { sanitizeImages, VARIANT_SPEC_KEYS } = require('./deriveCanonicalFacts');
    const existingCleanImages = sanitizeImages(canonicalProduct.images);
    const candidateCleanImages = sanitizeImages(adapted.candidateCanonical.images);
    if (existingCleanImages.length === 0 && candidateCleanImages.length > 0) {
      canonicalProduct.images = candidateCleanImages;
      isModified = true;
    } else if (existingCleanImages.length !== (canonicalProduct.images || []).length) {
      canonicalProduct.images = existingCleanImages.length > 0 ? existingCleanImages : candidateCleanImages;
      isModified = true;
    }

    // 3. Specifications: populate missing hardware specs & prune variant specs
    if (canonicalProduct.specifications && typeof canonicalProduct.specifications === 'object') {
      for (const k of Object.keys(canonicalProduct.specifications)) {
        if (VARIANT_SPEC_KEYS.has(k.toLowerCase().trim())) {
          delete canonicalProduct.specifications[k];
          canonicalProduct.markModified('specifications');
          isModified = true;
        }
      }
    }

    if (adapted.candidateCanonical.specifications && typeof adapted.candidateCanonical.specifications === 'object') {
      canonicalProduct.specifications = canonicalProduct.specifications || {};
      for (const [k, v] of Object.entries(adapted.candidateCanonical.specifications)) {
        if (canonicalProduct.specifications[k] === undefined && v !== undefined) {
          canonicalProduct.specifications[k] = v;
          canonicalProduct.markModified('specifications');
          isModified = true;
        }
      }
    }

    if (isModified) {
      await canonicalProduct.save();
    }
  } else {
    // Create new CanonicalProduct
    canonicalProduct = await CanonicalModel.create(adapted.candidateCanonical);
    canonicalOperation = 'created';
  }

  // 5. Upsert ProductOffer linked to the CanonicalProduct
  adapted.offer.canonicalProduct = canonicalProduct._id;
  const offerResult = await upsertProductOffer(adapted.offer, {
    ProductOfferModel: options.ProductOfferModel
  });

  return {
    success: true,
    canonicalOperation,
    offerOperation: offerResult.operation,
    canonicalProductId: canonicalProduct._id,
    offerId: offerResult.offer._id,
    canonicalKey: canonicalProduct.canonicalKey,
    brand: canonicalProduct.brand,
    model: canonicalProduct.model,
    modelIdentitySource: adapted.modelIdentitySource,
    identityConfidence: adapted.identityConfidence
  };
}

module.exports = {
  canonicalizeListing,
  resolveCategoryDocId
};
