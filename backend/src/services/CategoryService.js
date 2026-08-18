const categoryRepository = require('../repositories/CategoryRepository');

class CategoryService {
  async getActiveCategories() {
    return categoryRepository.findAllActive();
  }
}

module.exports = new CategoryService();
