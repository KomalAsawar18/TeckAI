const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const CanonicalProduct = require('../models/CanonicalProduct');
const { getCanonicalProductById } = require('../commerce/getCanonicalCatalog');
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
            products: [],
            canonicalProducts: []
          }
        });
      }

      // Clean up deleted legacy products
      const cleanedProducts = (wishlist.products || []).filter(prod => prod !== null);
      
      // Clean up and populate canonical products with bestOffer summaries
      const canonicalIds = (wishlist.canonicalProducts || []).map(id => id.toString ? id.toString() : id);
      const populatedCanonical = [];
      const validCanonicalIds = [];

      for (const cId of canonicalIds) {
        try {
          const canonicalData = await getCanonicalProductById(cId, { includeUnavailable: true });
          if (canonicalData) {
            populatedCanonical.push(canonicalData);
            validCanonicalIds.push(cId);
          }
        } catch (err) {
          // Exclude if canonical product no longer exists
        }
      }

      if (cleanedProducts.length !== (wishlist.products || []).length || validCanonicalIds.length !== canonicalIds.length) {
        wishlist.products = cleanedProducts;
        wishlist.canonicalProducts = validCanonicalIds;
        await wishlist.save();
      }

      return res.status(200).json({
        success: true,
        data: {
          _id: wishlist._id,
          user: wishlist.user,
          products: cleanedProducts,
          canonicalProducts: populatedCanonical
        }
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
      const { productId, canonicalProductId, isCanonical } = req.body;

      const targetId = canonicalProductId || productId;

      if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid product ID reference.'
          }
        });
      }

      // Check if it's a CanonicalProduct or legacy Product
      let isCanonicalTarget = Boolean(isCanonical || canonicalProductId);
      if (!isCanonicalTarget) {
        const canonicalExists = await CanonicalProduct.findById(targetId);
        if (canonicalExists) {
          isCanonicalTarget = true;
        }
      }

      if (isCanonicalTarget) {
        const canonicalProd = await CanonicalProduct.findById(targetId);
        if (!canonicalProd) {
          return res.status(400).json({
            success: false,
            error: { message: 'Product not found in catalog.' }
          });
        }
        if (!canonicalProd.isActive) {
          return res.status(400).json({
            success: false,
            error: { message: 'Product is no longer active in our catalog.' }
          });
        }

        await Wishlist.findOneAndUpdate(
          { user: userId },
          { $addToSet: { canonicalProducts: targetId } },
          { new: true, upsert: true }
        );
      } else {
        const product = await Product.findById(targetId);
        if (!product) {
          return res.status(400).json({
            success: false,
            error: { message: 'Product not found in catalog.' }
          });
        }
        if (!product.isActive) {
          return res.status(400).json({
            success: false,
            error: { message: 'Product is no longer active in our catalog.' }
          });
        }

        await Wishlist.findOneAndUpdate(
          { user: userId },
          { $addToSet: { products: targetId } },
          { new: true, upsert: true }
        );
      }

      // Return refreshed wishlist
      return this.getWishlist(req, res, next);
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

      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid product ID reference.'
          }
        });
      }

      await Wishlist.findOneAndUpdate(
        { user: userId },
        { $pull: { products: productId, canonicalProducts: productId } },
        { new: true }
      );

      return this.getWishlist(req, res, next);
    } catch (error) {
      logger.error(`RemoveFromWishlist controller error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new WishlistController();
