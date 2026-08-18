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

  async createCategory(req, res, next) {
    try {
      const { name, slug } = req.body;
      if (!name || !slug) {
        return res.status(400).json({ success: false, error: { message: 'Category name and slug are required.' } });
      }

      const mongoose = require('mongoose');
      const Category = mongoose.model('Category');

      const duplicateSlug = await Category.findOne({ slug: slug.trim().toLowerCase() });
      if (duplicateSlug) {
        return res.status(400).json({ success: false, error: { message: 'Category slug is already in use.' } });
      }

      const category = new Category({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        isActive: true
      });

      await category.save();
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CategoryController();
