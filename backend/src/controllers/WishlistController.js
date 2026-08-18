const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const logger = require('../config/logger');

class WishlistController {
  /**
   * Fetch current authenticated user's wishlist populated with product catalog details
   */
  async getWishlist(req, res, next) {
    try {
      const userId = req.user._id;

      let wishlist = await Wishlist.findOne({ user: userId }).populate({
        path: 'products',
        select: 'name slug price images stock brand isActive rating reviewCount'
      });

      if (!wishlist) {
        return res.status(200).json({
          success: true,
          data: {
            user: userId,
            products: []
          }
        });
      }

      // Filter out any items where product might have been deleted, keeping wishlist clean
      const cleanedProducts = wishlist.products.filter(prod => prod !== null);
      if (cleanedProducts.length !== wishlist.products.length) {
        wishlist.products = cleanedProducts;
        await wishlist.save();
      }

      return res.status(200).json({
        success: true,
        data: wishlist
      });
    } catch (error) {
      logger.error(`GetWishlist controller error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Add a product reference to the wishlist using duplicate-safe $addToSet
   */
  async addToWishlist(req, res, next) {
    try {
      const userId = req.user._id;
      const { productId } = req.body;

      // 1. Validate ID formatting
      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid product ID reference.'
          }
        });
      }

      // 2. Validate product exists in catalog (Source of truth)
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Product not found in catalog.'
          }
        });
      }

      // 3. Validate product is active
      if (!product.isActive) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Product is no longer active in our catalog.'
          }
        });
      }

      // 4. Update wishlist using $addToSet (Duplicate prevention)
      const wishlist = await Wishlist.findOneAndUpdate(
        { user: userId },
        { $addToSet: { products: productId } },
        { new: true, upsert: true }
      ).populate({
        path: 'products',
        select: 'name slug price images stock brand isActive rating reviewCount'
      });

      logger.info(`Product ${productId} added to wishlist for user ${req.user.email}`);

      return res.status(200).json({
        success: true,
        data: wishlist
      });
    } catch (error) {
      logger.error(`AddToWishlist controller error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Remove a product reference from the wishlist using $pull
   */
  async removeFromWishlist(req, res, next) {
    try {
      const userId = req.user._id;
      const { productId } = req.params;

      // Validate ID formatting
      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid product ID reference.'
          }
        });
      }

      // Update wishlist using $pull to delete item
      const wishlist = await Wishlist.findOneAndUpdate(
        { user: userId },
        { $pull: { products: productId } },
        { new: true }
      ).populate({
        path: 'products',
        select: 'name slug price images stock brand isActive rating reviewCount'
      });

      if (!wishlist) {
        return res.status(200).json({
          success: true,
          data: {
            user: userId,
            products: []
          }
        });
      }

      logger.info(`Product ${productId} removed from wishlist for user ${req.user.email}`);

      return res.status(200).json({
        success: true,
        data: wishlist
      });
    } catch (error) {
      logger.error(`RemoveFromWishlist controller error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new WishlistController();
