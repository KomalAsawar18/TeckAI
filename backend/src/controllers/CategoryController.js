const categoryService = require('../services/CategoryService');

class CategoryController {
  async getCategories(req, res, next) {
    try {
      const categories = await categoryService.getActiveCategories();
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CategoryController();
