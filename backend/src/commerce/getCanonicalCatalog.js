const mongoose = require('mongoose');
const CanonicalProduct = require('../models/CanonicalProduct');
const ProductOffer = require('../models/ProductOffer');
const Category = require('../models/Category');
const { compareOffers } = require('./compareOffers');
const BadRequestError = require('../errors/BadRequestError');
const NotFoundError = require('../errors/NotFoundError');

function escapeRegex(text) {
  return String(text).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Retrieves the public canonical product catalog with computed best offer summaries.
 * 
 * @param {Object} query
 * @param {number|string} [query.page=1]
 * @param {number|string} [query.limit=20]
 * @param {string} [query.category]
 * @param {string} [query.brand]
 * @param {string} [query.search]
 * @param {number|string} [query.minPrice]
 * @param {number|string} [query.maxPrice]
 * @param {string} [query.sort='newest'] - 'price_asc' | 'price_desc' | 'name_asc' | 'newest'
 * @param {boolean|string} [query.includeUnavailable=false]
 * @returns {Promise<{ products: Array<Object>, pagination: { page: number, limit: number, total: number, totalPages: number } }>}
 */
async function getCanonicalCatalog(query = {}) {
  const {
    page,
    limit,
    category,
    brand,
    search,
    minPrice,
    maxPrice,
    sort,
    includeUnavailable
  } = query;

  // 1. Validate & parse pagination
  let parsedPage = 1;
  if (page !== undefined && page !== '') {
    parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      throw new BadRequestError('Invalid page parameter. Must be a positive integer.');
    }
  }

  let parsedLimit = 20;
  if (limit !== undefined && limit !== '') {
    parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestError('Invalid limit parameter. Must be a positive integer.');
    }
    parsedLimit = Math.min(100, parsedLimit);
  }

  // 2. Validate & parse price boundaries
  let parsedMinPrice;
  if (minPrice !== undefined && minPrice !== '') {
    parsedMinPrice = Number(minPrice);
    if (isNaN(parsedMinPrice) || parsedMinPrice < 0) {
      throw new BadRequestError('minPrice must be a non-negative number.');
    }
  }

  let parsedMaxPrice;
  if (maxPrice !== undefined && maxPrice !== '') {
    parsedMaxPrice = Number(maxPrice);
    if (isNaN(parsedMaxPrice) || parsedMaxPrice < 0) {
      throw new BadRequestError('maxPrice must be a non-negative number.');
    }
  }

  if (parsedMinPrice !== undefined && parsedMaxPrice !== undefined && parsedMinPrice > parsedMaxPrice) {
    throw new BadRequestError('minPrice cannot exceed maxPrice.');
  }

  const shouldIncludeUnavailable = Boolean(
    includeUnavailable === true || includeUnavailable === 'true' || includeUnavailable === '1'
  );

  // 3. Resolve category filter if provided
  let categoryId = null;
  if (category) {
    const trimmedCat = String(category).trim();
    if (mongoose.Types.ObjectId.isValid(trimmedCat)) {
      const foundById = await Category.findById(trimmedCat).lean();
      if (foundById) {
        categoryId = foundById._id;
      } else {
        const foundBySlug = await Category.findOne({ slug: trimmedCat }).lean();
        if (foundBySlug) categoryId = foundBySlug._id;
      }
    } else {
      const found = await Category.findOne({
        $or: [
          { slug: trimmedCat },
          { name: new RegExp(`^${escapeRegex(trimmedCat)}$`, 'i') }
        ]
      }).lean();
      if (found) categoryId = found._id;
    }

    // If a category was requested but does not exist, return empty catalog safely
    if (!categoryId) {
      return {
        products: [],
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total: 0,
          totalPages: 0
        }
      };
    }
  }

  // 4. Construct CanonicalProduct query filter
  const filter = { isActive: true };
  if (categoryId) {
    filter.category = categoryId;
  }

  if (brand && String(brand).trim()) {
    const trimmedBrand = String(brand).trim();
    filter.brand = new RegExp(`^${escapeRegex(trimmedBrand)}$`, 'i');
  }

  if (search && String(search).trim()) {
    const trimmedSearch = String(search).trim();
    const searchRegex = new RegExp(escapeRegex(trimmedSearch), 'i');
    filter.$or = [
      { name: searchRegex },
      { brand: searchRegex },
      { model: searchRegex }
    ];
  }

  // 5. Query matching active CanonicalProducts
  const canonicalProducts = await CanonicalProduct.find(filter)
    .populate('category', 'name slug')
    .lean();

  if (canonicalProducts.length === 0) {
    return {
      products: [],
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: 0,
        totalPages: 0
      }
    };
  }

  // 6. Query all active offers for the matched canonical products
  const canonicalIds = canonicalProducts.map(p => p._id);
  const activeOffers = await ProductOffer.find({
    canonicalProduct: { $in: canonicalIds },
    isActive: true
  }).lean();

  // Group offers by canonical product ID
  const offersByCanonical = new Map();
  for (const offer of activeOffers) {
    if (!offer.canonicalProduct) continue;
    const cId = offer.canonicalProduct.toString();
    if (!offersByCanonical.has(cId)) {
      offersByCanonical.set(cId, []);
    }
    offersByCanonical.get(cId).push(offer);
  }

  // 7. Evaluate comparison, compute best offer, and apply offer-level filters
  const catalogItems = [];
  for (const product of canonicalProducts) {
    const pOffers = offersByCanonical.get(product._id.toString()) || [];
    const comparison = compareOffers(pOffers, { includeUnavailable: shouldIncludeUnavailable });
    const bestOffer = comparison.bestOffer;

    // Availability filter: exclude products without eligible best offer unless includeUnavailable is set
    if (!shouldIncludeUnavailable && !bestOffer) {
      continue;
    }

    // Price filters: operate on computed bestOffer price
    if (parsedMinPrice !== undefined) {
      if (!bestOffer || bestOffer.price < parsedMinPrice) {
        continue;
      }
    }
    if (parsedMaxPrice !== undefined) {
      if (!bestOffer || bestOffer.price > parsedMaxPrice) {
        continue;
      }
    }

    catalogItems.push({
      id: product._id.toString(),
      name: product.name,
      brand: product.brand || null,
      model: product.model || null,
      category: product.category ? {
        id: product.category._id ? product.category._id.toString() : product.category.toString(),
        name: product.category.name,
        slug: product.category.slug
      } : null,
      images: Array.isArray(product.images) ? product.images : [],
      specifications: product.specifications || {},
      bestOffer: bestOffer ? {
        id: bestOffer._id ? bestOffer._id.toString() : (bestOffer.id || null),
        seller: bestOffer.seller?.name || bestOffer.source?.name || null,
        price: bestOffer.price,
        currency: bestOffer.currency || 'PKR',
        availability: bestOffer.availability,
        condition: bestOffer.condition,
        variant: bestOffer.variant || null,
        redirectUrl: `/api/offers/${bestOffer._id || bestOffer.id}/redirect`
      } : null,
      offerCount: comparison.summary.totalOffers,
      sellerCount: comparison.summary.sellerCount,
      sourceCount: comparison.summary.sourceCount,
      // Internal metadata used solely for deterministic catalog sorting
      _createdAt: product.createdAt ? new Date(product.createdAt).getTime() : 0,
      _bestPrice: bestOffer && typeof bestOffer.price === 'number' ? bestOffer.price : null
    });
  }

  // 8. Sorting
  const sortMode = (sort || 'newest').toLowerCase().trim();
  if (sortMode === 'price_asc') {
    catalogItems.sort((a, b) => {
      const priceA = a._bestPrice !== null ? a._bestPrice : Infinity;
      const priceB = b._bestPrice !== null ? b._bestPrice : Infinity;
      if (priceA !== priceB) return priceA - priceB;
      return a.name.localeCompare(b.name);
    });
  } else if (sortMode === 'price_desc') {
    catalogItems.sort((a, b) => {
      const priceA = a._bestPrice !== null ? a._bestPrice : -Infinity;
      const priceB = b._bestPrice !== null ? b._bestPrice : -Infinity;
      if (priceA !== priceB) return priceB - priceA;
      return a.name.localeCompare(b.name);
    });
  } else if (sortMode === 'name_asc') {
    catalogItems.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // 'newest' or default
    catalogItems.sort((a, b) => {
      if (a._createdAt !== b._createdAt) return b._createdAt - a._createdAt;
      return a.name.localeCompare(b.name);
    });
  }

  // 9. Pagination slicing
  const total = catalogItems.length;
  const totalPages = Math.ceil(total / parsedLimit);
  const startIndex = (parsedPage - 1) * parsedLimit;
  const pagedItems = catalogItems.slice(startIndex, startIndex + parsedLimit);

  // Strip temporary internal sorting keys
  const sanitizedProducts = pagedItems.map(({ _createdAt, _bestPrice, ...publicShape }) => publicShape);

  return {
    products: sanitizedProducts,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages
    }
  };
}

/**
 * Retrieves a single canonical product with its computed best offer summary.
 * 
 * @param {string} id - CanonicalProduct ObjectId
 * @param {Object} [options]
 * @param {boolean|string} [options.includeUnavailable=false]
 * @returns {Promise<Object>}
 */
async function getCanonicalProductById(id, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError('Invalid canonical product ID format');
  }

  const product = await CanonicalProduct.findOne({ _id: id, isActive: true })
    .populate('category', 'name slug')
    .lean();

  if (!product) {
    throw new NotFoundError('Canonical product not found');
  }

  const shouldIncludeUnavailable = Boolean(
    options.includeUnavailable === true || options.includeUnavailable === 'true' || options.includeUnavailable === '1'
  );

  const offers = await ProductOffer.find({
    canonicalProduct: product._id,
    isActive: true
  }).lean();

  const comparison = compareOffers(offers, { includeUnavailable: shouldIncludeUnavailable });
  const bestOffer = comparison.bestOffer;

  return {
    id: product._id.toString(),
    name: product.name,
    brand: product.brand || null,
    model: product.model || null,
    category: product.category ? {
      id: product.category._id ? product.category._id.toString() : product.category.toString(),
      name: product.category.name,
      slug: product.category.slug
    } : null,
    images: Array.isArray(product.images) ? product.images : [],
    specifications: product.specifications || {},
    bestOffer: bestOffer ? {
      id: bestOffer._id ? bestOffer._id.toString() : (bestOffer.id || null),
      seller: bestOffer.seller?.name || bestOffer.source?.name || null,
      price: bestOffer.price,
      currency: bestOffer.currency || 'PKR',
      availability: bestOffer.availability,
      condition: bestOffer.condition,
      variant: bestOffer.variant || null,
      redirectUrl: `/api/offers/${bestOffer._id || bestOffer.id}/redirect`
    } : null,
    offerCount: comparison.summary.totalOffers,
    sellerCount: comparison.summary.sellerCount,
    sourceCount: comparison.summary.sourceCount
  };
}

module.exports = {
  getCanonicalCatalog,
  getCanonicalProductById
};
