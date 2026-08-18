const productRepository = require('../repositories/ProductRepository');
const categoryRepository = require('../repositories/CategoryRepository');
const NotFoundError = require('../errors/NotFoundError');
const BadRequestError = require('../errors/BadRequestError');

class ProductService {
  async getProducts({
    categorySlug,
    search,
    brand,
    minPrice,
    maxPrice,
    sort,
    page = 1,
    limit = 12
  }) {
    let categoryId = null;

    // Resolve category slug to category ID if category filter was provided
    if (categorySlug) {
      const categoryObj = await categoryRepository.findBySlug(categorySlug);
      if (!categoryObj) {
        // If category is not found, return empty results early
        return {
          products: [],
          totalItems: 0
        };
      }
      categoryId = categoryObj._id;
    }

    // Input sanitization / validation helper checks
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 12));

    const parsedMinPrice = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : undefined;
    const parsedMaxPrice = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : undefined;

    if (parsedMinPrice !== undefined && isNaN(parsedMinPrice)) {
      throw new BadRequestError('Invalid minPrice value');
    }
    if (parsedMaxPrice !== undefined && isNaN(parsedMaxPrice)) {
      throw new BadRequestError('Invalid maxPrice value');
    }

    const result = await productRepository.findAndCount({
      category: categoryId,
      search: search ? String(search).trim() : undefined,
      brand: brand ? String(brand).trim() : undefined,
      minPrice: parsedMinPrice,
      maxPrice: parsedMaxPrice,
      sort,
      page: parsedPage,
      limit: parsedLimit
    });

    return {
      products: result.products,
      totalItems: result.totalItems,
      page: parsedPage,
      limit: parsedLimit
    };
  }

  async getProductBySlug(slug) {
    if (!slug) {
      throw new BadRequestError('Product slug is required');
    }
    const product = await productRepository.findBySlug(slug);
    if (!product) {
      throw new NotFoundError(`Product not found with slug: ${slug}`);
    }
    return product;
  }
}

module.exports = new ProductService();
