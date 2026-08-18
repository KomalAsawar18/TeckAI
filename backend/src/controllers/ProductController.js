const productService = require('../services/ProductService');

class ProductController {
  async getProducts(req, res, next) {
    try {
      const {
        category,
        search,
        brand,
        minPrice,
        maxPrice,
        sort,
        page,
        limit
      } = req.query;

      const result = await productService.getProducts({
        categorySlug: category,
        search,
        brand,
        minPrice,
        maxPrice,
        sort,
        page,
        limit
      });

      const totalPages = Math.ceil(result.totalItems / result.limit);

      res.json({
        success: true,
        data: result.products,
        pagination: {
          page: result.page,
          limit: result.limit,
          totalItems: result.totalItems,
          totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const product = await productService.getProductBySlug(slug);
      
      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
