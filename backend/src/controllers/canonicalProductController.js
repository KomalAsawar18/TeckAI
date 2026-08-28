const { getProductOffersComparison } = require('../commerce/getProductOffersComparison');
const { getCanonicalCatalog, getCanonicalProductById } = require('../commerce/getCanonicalCatalog');

/**
 * Controller for retrieving the canonical products catalog with best offer summaries.
 * GET /api/canonical-products
 */
async function getCanonicalProducts(req, res, next) {
  try {
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
    } = req.query;

    const result = await getCanonicalCatalog({
      page,
      limit,
      category,
      brand,
      search,
      minPrice,
      maxPrice,
      sort,
      includeUnavailable
    });

    return res.status(200).json({
      success: true,
      products: result.products,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for retrieving a single canonical product with its best offer summary.
 * GET /api/canonical-products/:id
 */
async function getCanonicalProduct(req, res, next) {
  try {
    const { id } = req.params;
    const { includeUnavailable } = req.query;

    const product = await getCanonicalProductById(id, { includeUnavailable });
    return res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for retrieving canonical product offers and best offer comparison.
 * GET /api/canonical-products/:id/offers
 */
async function getCanonicalProductOffers(req, res, next) {
  try {
    const { id } = req.params;
    const {
      condition,
      color,
      configuration,
      includeUnavailable
    } = req.query;

    const options = {
      condition,
      color,
      configuration,
      includeUnavailable: includeUnavailable === 'true' || includeUnavailable === '1'
    };

    const result = await getProductOffersComparison(id, options);
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCanonicalProducts,
  getCanonicalProduct,
  getCanonicalProductOffers
};

