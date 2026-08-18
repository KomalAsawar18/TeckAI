const mongoose = require('mongoose');
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

  async getAdminProducts(req, res, next) {
    try {
      const Product = mongoose.model('Product');
      const products = await Product.find({}).populate('category', 'name slug').sort({ createdAt: -1 });
      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }

  async createProduct(req, res, next) {
    try {
      const { name, slug, sku, description, price, stock, category, brand, image } = req.body;

      if (!name || !slug || !sku || !description || price === undefined || stock === undefined || !category || !brand) {
        return res.status(400).json({ success: false, error: { message: 'All required product fields must be provided.' } });
      }

      const parsedPrice = Number(price);
      const parsedStock = Number(stock);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ success: false, error: { message: 'Price must be a number greater than or equal to 0.' } });
      }
      if (isNaN(parsedStock) || parsedStock < 0) {
        return res.status(400).json({ success: false, error: { message: 'Stock must be a number greater than or equal to 0.' } });
      }

      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ success: false, error: { message: 'Invalid category reference ID.' } });
      }
      const Category = mongoose.model('Category');
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({ success: false, error: { message: 'Category reference not found.' } });
      }

      const Product = mongoose.model('Product');
      const duplicateSlug = await Product.findOne({ slug });
      if (duplicateSlug) {
        return res.status(400).json({ success: false, error: { message: 'Product slug is already in use.' } });
      }
      const duplicateSku = await Product.findOne({ sku });
      if (duplicateSku) {
        return res.status(400).json({ success: false, error: { message: 'Product SKU is already in use.' } });
      }

      const product = new Product({
        name: name.trim(),
        slug: slug.trim(),
        sku: sku.trim(),
        description: description.trim(),
        price: parsedPrice,
        stock: parsedStock,
        category,
        brand: brand.trim(),
        images: image ? [image.trim()] : []
      });

      await product.save();
      res.status(201).json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: { message: 'Invalid product ID.' } });
      }

      const Product = mongoose.model('Product');
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ success: false, error: { message: 'Product not found.' } });
      }

      const updates = req.body;

      if (updates.price !== undefined) {
        const parsedPrice = Number(updates.price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          return res.status(400).json({ success: false, error: { message: 'Price must be a number greater than or equal to 0.' } });
        }
        product.price = parsedPrice;
      }

      if (updates.stock !== undefined) {
        const parsedStock = Number(updates.stock);
        if (isNaN(parsedStock) || parsedStock < 0) {
          return res.status(400).json({ success: false, error: { message: 'Stock must be a number greater than or equal to 0.' } });
        }
        product.stock = parsedStock;
      }

      if (updates.category !== undefined) {
        if (!mongoose.Types.ObjectId.isValid(updates.category)) {
          return res.status(400).json({ success: false, error: { message: 'Invalid category reference ID.' } });
        }
        const Category = mongoose.model('Category');
        const categoryExists = await Category.findById(updates.category);
        if (!categoryExists) {
          return res.status(400).json({ success: false, error: { message: 'Category reference not found.' } });
        }
        product.category = updates.category;
      }

      if (updates.slug !== undefined && updates.slug.trim() !== product.slug) {
        const duplicateSlug = await Product.findOne({ slug: updates.slug.trim() });
        if (duplicateSlug) {
          return res.status(400).json({ success: false, error: { message: 'Product slug is already in use.' } });
        }
        product.slug = updates.slug.trim();
      }

      if (updates.sku !== undefined && updates.sku.trim() !== product.sku) {
        const duplicateSku = await Product.findOne({ sku: updates.sku.trim() });
        if (duplicateSku) {
          return res.status(400).json({ success: false, error: { message: 'Product SKU is already in use.' } });
        }
        product.sku = updates.sku.trim();
      }

      const stringFields = ['name', 'brand', 'description'];
      for (const field of stringFields) {
        if (updates[field] !== undefined) {
          product[field] = String(updates[field]).trim();
        }
      }

      if (updates.isActive !== undefined) {
        product.isActive = Boolean(updates.isActive);
      }

      if (updates.image !== undefined) {
        product.images = updates.image ? [String(updates.image).trim()] : [];
      }

      await product.save();
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
