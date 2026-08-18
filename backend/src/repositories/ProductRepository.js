const Product = require('../models/Product');

class ProductRepository {
  async findAndCount({
    category,
    search,
    brand,
    minPrice,
    maxPrice,
    sort,
    page = 1,
    limit = 12
  }) {
    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (brand) {
      query.brand = { $regex: new RegExp(`^${brand}$`, 'i') };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
    }

    // Sorting
    let sortOptions = {};
    if (sort === 'price_asc') {
      sortOptions.price = 1;
    } else if (sort === 'price_desc') {
      sortOptions.price = -1;
    } else if (sort === 'newest') {
      sortOptions.createdAt = -1;
    } else {
      // Default: featured first, then newest
      sortOptions.isFeatured = -1;
      sortOptions.createdAt = -1;
    }

    const skipIndex = (page - 1) * limit;

    const [products, totalItems] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug')
        .sort(sortOptions)
        .skip(skipIndex)
        .limit(limit),
      Product.countDocuments(query)
    ]);

    return {
      products,
      totalItems
    };
  }

  async findBySlug(slug) {
    return Product.findOne({ slug, isActive: true }).populate('category', 'name slug');
  }
}

module.exports = new ProductRepository();
