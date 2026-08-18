const Category = require('../models/Category');

class CategoryRepository {
  async findAllActive() {
    return Category.find({ isActive: true }).sort({ name: 1 });
  }

  async findBySlug(slug) {
    return Category.findOne({ slug, isActive: true });
  }
}

module.exports = new CategoryRepository();
