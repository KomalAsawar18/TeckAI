const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const logger = require('../config/logger');

class CartController {
  /**
   * Fetch current authenticated user's cart populated with authoritative product data
   */
  async getCart(req, res, next) {
    try {
      const userId = req.user._id;

      let cart = await Cart.findOne({ user: userId }).populate({
        path: 'items.product',
        select: 'name slug price images stock brand isActive'
      });

      if (!cart) {
        return res.status(200).json({
          success: true,
          data: {
            user: userId,
            items: []
          }
        });
      }

      // Filter out any items where product might have been deleted, keeping cart clean
      const cleanedItems = cart.items.filter(item => item.product !== null);
      if (cleanedItems.length !== cart.items.length) {
        cart.items = cleanedItems;
        await cart.save();
      }

      return res.status(200).json({
        success: true,
        data: cart
      });
    } catch (error) {
      logger.error(`GetCart controller error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Overwrite cart state - performs stock limits validation on database records
   */
  async updateCart(req, res, next) {
    try {
      const userId = req.user._id;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Items must be a valid array.'
          }
        });
      }

      const validatedItems = [];

      // Validate each item against database truths
      for (const item of items) {
        const { product: productId, quantity } = item;

        // 1. Check ID structure
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
          return res.status(400).json({
            success: false,
            error: {
              message: `Invalid product ID reference: ${productId}`
            }
          });
        }

        // 2. Check quantity integrity (must be non-negative, non-zero integer)
        const parsedQuantity = parseInt(quantity, 10);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Product quantities must be integers greater than zero.'
            }
          });
        }

        // 3. Fetch product details from DB (Source of Truth)
        const product = await Product.findById(productId);
        if (!product) {
          return res.status(400).json({
            success: false,
            error: {
              message: `Product not found in our catalog.`
            }
          });
        }

        // 4. Verify product status
        if (!product.isActive) {
          return res.status(400).json({
            success: false,
            error: {
              message: `Product "${product.name}" is no longer active in our catalog.`
            }
          });
        }

        // 5. Verify database stock levels
        if (product.stock < parsedQuantity) {
          return res.status(400).json({
            success: false,
            error: {
              message: `Requested quantity (${parsedQuantity}) for "${product.name}" exceeds available stock (${product.stock}).`
            }
          });
        }

        validatedItems.push({
          product: productId,
          quantity: parsedQuantity
        });
      }

      // Find or create cart and replace full items state
      let cart = await Cart.findOne({ user: userId });
      if (!cart) {
        cart = new Cart({
          user: userId,
          items: validatedItems
        });
      } else {
        cart.items = validatedItems;
      }

      await cart.save();

      // Return fully populated cart so frontend has authoritative pricing and updates
      const populatedCart = await Cart.findById(cart._id).populate({
        path: 'items.product',
        select: 'name slug price images stock brand isActive'
      });

      logger.info(`Cart updated successfully for user ${req.user.email}`);

      return res.status(200).json({
        success: true,
        data: populatedCart
      });
    } catch (error) {
      logger.error(`UpdateCart controller error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new CartController();
