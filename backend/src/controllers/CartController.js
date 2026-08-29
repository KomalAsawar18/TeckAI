const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const CanonicalProduct = require('../models/CanonicalProduct');
const ProductOffer = require('../models/ProductOffer');
const logger = require('../config/logger');

class CartController {
  /**
   * Helper to populate cart items across legacy and canonical items
   */
  _populateCart(query) {
    return query
      .populate({
        path: 'items.product',
        select: 'name slug price images stock brand isActive'
      })
      .populate({
        path: 'items.canonicalProduct',
        select: 'name brand model images specifications category isActive'
      })
      .populate({
        path: 'items.productOffer',
        select: 'price currency availability stock condition variant seller source.name isActive'
      });
  }

  /**
   * Fetch current authenticated user's cart populated with authoritative product data
   */
  async getCart(req, res, next) {
    try {
      const userId = req.user._id;

      let cart = await this._populateCart(Cart.findOne({ user: userId }));

      if (!cart) {
        return res.status(200).json({
          success: true,
          data: {
            user: userId,
            items: []
          }
        });
      }

      // Filter out any items where referenced products no longer exist
      const cleanedItems = cart.items.filter(item => {
        if (item.itemType === 'canonical' || item.canonicalProduct) {
          return item.canonicalProduct !== null && item.productOffer !== null;
        }
        return item.product !== null;
      });

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
        const isCanonical = item.itemType === 'canonical' || !!item.canonicalProduct;
        const parsedQuantity = parseInt(item.quantity, 10);

        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Product quantities must be integers greater than zero.'
            }
          });
        }

        if (isCanonical) {
          const canonicalId = (item.canonicalProduct?._id || item.canonicalProduct || item.canonicalProductId)?.toString();
          const offerId = (item.productOffer?._id || item.productOffer || item.selectedProductOfferId || item.productOfferId)?.toString();

          if (!canonicalId || !mongoose.Types.ObjectId.isValid(canonicalId)) {
            return res.status(400).json({
              success: false,
              error: { message: `Invalid canonical product ID: ${canonicalId}` }
            });
          }

          if (!offerId || !mongoose.Types.ObjectId.isValid(offerId)) {
            return res.status(400).json({
              success: false,
              error: { message: `Invalid product offer ID: ${offerId}` }
            });
          }

          const [canonicalProd, offer] = await Promise.all([
            CanonicalProduct.findById(canonicalId),
            ProductOffer.findById(offerId)
          ]);

          if (!canonicalProd || !canonicalProd.isActive) {
            return res.status(400).json({
              success: false,
              error: { message: `Product "${canonicalProd?.name || 'Item'}" is no longer active.` }
            });
          }

          if (!offer || offer.isActive === false) {
            return res.status(400).json({
              success: false,
              error: { message: `The selected retailer offer is no longer available.` }
            });
          }

          // Verify offer belongs to canonical product
          if (offer.canonicalProduct.toString() !== canonicalId) {
            return res.status(400).json({
              success: false,
              error: { message: `Offer does not match the specified canonical product.` }
            });
          }

          if (offer.availability === 'out_of_stock') {
            const sellerName = offer.seller?.name || 'Selected seller';
            return res.status(400).json({
              success: false,
              error: { message: `"${canonicalProd.name}" from ${sellerName} is currently out of stock.` }
            });
          }

          if (offer.stock !== undefined && offer.stock < parsedQuantity) {
            return res.status(400).json({
              success: false,
              error: { message: `Requested quantity (${parsedQuantity}) exceeds available stock (${offer.stock}).` }
            });
          }

          validatedItems.push({
            itemType: 'canonical',
            canonicalProduct: canonicalId,
            productOffer: offerId,
            variant: item.variant || offer.variant || null,
            priceSnapshot: offer.price,
            quantity: parsedQuantity
          });
        } else {
          // Legacy product item validation
          const productId = (item.product?._id || item.product)?.toString();

          if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
              success: false,
              error: {
                message: `Invalid product ID reference: ${productId}`
              }
            });
          }

          const product = await Product.findById(productId);
          if (!product) {
            return res.status(400).json({
              success: false,
              error: {
                message: `Product not found in our catalog.`
              }
            });
          }

          if (!product.isActive) {
            return res.status(400).json({
              success: false,
              error: {
                message: `Product "${product.name}" is no longer active in our catalog.`
              }
            });
          }

          const isOutOfStock = product.availability === 'out_of_stock';
          const isUnknownUnavailable = product.availability === 'unknown' && product.stock === undefined;
          
          if (isOutOfStock || isUnknownUnavailable) {
            return res.status(400).json({
              success: false,
              error: {
                message: `Product "${product.name}" is currently out of stock or unavailable.`
              }
            });
          }

          if (product.stock !== undefined && product.stock < parsedQuantity) {
            return res.status(400).json({
              success: false,
              error: {
                message: `Requested quantity (${parsedQuantity}) for "${product.name}" exceeds available stock (${product.stock}).`
              }
            });
          }

          validatedItems.push({
            itemType: 'legacy',
            product: productId,
            priceSnapshot: product.price,
            quantity: parsedQuantity
          });
        }
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
      const populatedCart = await this._populateCart(Cart.findById(cart._id));

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
