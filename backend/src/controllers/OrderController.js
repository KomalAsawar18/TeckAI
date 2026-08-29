const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const CanonicalProduct = require('../models/CanonicalProduct');
const ProductOffer = require('../models/ProductOffer');

// Create a new order (Checkout)
exports.createOrder = async (req, res) => {
  const { shippingAddress, acceptPriceChange } = req.body;

  // 1. Validate shipping address server-side
  if (!shippingAddress) {
    return res.status(400).json({ success: false, error: { message: 'Shipping address is required.' } });
  }

  const requiredFields = ['fullName', 'addressLine', 'city', 'postalCode', 'country'];
  for (const field of requiredFields) {
    if (!shippingAddress[field] || typeof shippingAddress[field] !== 'string' || !shippingAddress[field].trim()) {
      return res.status(400).json({ success: false, error: { message: `Shipping address field "${field}" is required and cannot be empty.` } });
    }
  }

  // Start MongoDB session and transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 2. Fetch the user's cart from database
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product')
      .populate('items.canonicalProduct')
      .populate('items.productOffer')
      .session(session);

    if (!cart || cart.items.length === 0) {
      throw new Error('Your cart is empty.');
    }

    const orderItems = [];
    let subtotal = 0;

    // 3. Process each cart item with atomic conditional stock checks & revalidation
    for (const item of cart.items) {
      const isCanonical = item.itemType === 'canonical' || !!item.canonicalProduct;

      if (isCanonical) {
        const canonicalProd = item.canonicalProduct;
        const offer = item.productOffer;

        if (!canonicalProd || !offer) {
          throw new Error('One or more canonical products or retailer offers in your cart no longer exist.');
        }

        if (!canonicalProd.isActive) {
          throw new Error(`Product "${canonicalProd.name}" is currently inactive in our catalog.`);
        }

        if (offer.isActive === false) {
          throw new Error(`The offer for "${canonicalProd.name}" from ${offer.seller?.name || 'retailer'} is no longer active.`);
        }

        if (offer.availability === 'out_of_stock') {
          throw new Error(`"${canonicalProd.name}" from ${offer.seller?.name || 'retailer'} is currently out of stock.`);
        }

        // Live Price Revalidation: Check if price changed materially
        if (typeof item.priceSnapshot === 'number' && offer.price !== item.priceSnapshot && !acceptPriceChange) {
          const sellerName = offer.seller?.name || 'the seller';
          const priceError = new Error(`The price for "${canonicalProd.name}" from ${sellerName} has changed from ${offer.currency || 'PKR'} ${item.priceSnapshot.toLocaleString()} to ${offer.currency || 'PKR'} ${offer.price.toLocaleString()}. Please review before placing order.`);
          priceError.code = 'PRICE_CHANGED';
          priceError.oldPrice = item.priceSnapshot;
          priceError.newPrice = offer.price;
          priceError.productName = canonicalProd.name;
          throw priceError;
        }

        // Atomically check and decrement stock if numeric stock is tracked on offer
        if (offer.stock !== undefined) {
          const updatedOffer = await ProductOffer.findOneAndUpdate(
            { _id: offer._id, stock: { $gte: item.quantity }, isActive: true },
            { $inc: { stock: -item.quantity } },
            { new: true, session }
          );

          if (!updatedOffer) {
            throw new Error(`Insufficient stock for "${canonicalProd.name}" from ${offer.seller?.name || 'retailer'}. Available: ${offer.stock}, Requested: ${item.quantity}`);
          }
        }

        const itemPrice = offer.price;
        subtotal += itemPrice * item.quantity;

        orderItems.push({
          itemType: 'canonical',
          canonicalProduct: canonicalProd._id,
          productOffer: offer._id,
          name: canonicalProd.name,
          price: itemPrice,
          currency: offer.currency || 'PKR',
          quantity: item.quantity,
          image: canonicalProd.images?.[0] || '',
          seller: offer.seller?.name || 'Retail Supplier',
          source: offer.source?.name || 'Retailer Feed',
          condition: offer.condition || 'new',
          variant: item.variant || offer.variant || null,
          fulfillmentMode: 'external_supplier'
        });
      } else {
        // Legacy product item validation
        const prod = item.product;
        if (!prod) {
          throw new Error('One or more products in your cart no longer exist.');
        }

        if (!prod.isActive) {
          throw new Error(`Product "${prod.name}" is currently unavailable.`);
        }

        let updatedProduct;
        if (prod.stock !== undefined) {
          updatedProduct = await Product.findOneAndUpdate(
            { _id: prod._id, stock: { $gte: item.quantity }, isActive: true },
            { $inc: { stock: -item.quantity } },
            { new: true, session }
          );
        } else {
          const isOutOfStock = prod.availability === 'out_of_stock';
          const isUnknownUnavailable = prod.availability === 'unknown';
          if (isOutOfStock || isUnknownUnavailable) {
            updatedProduct = null;
          } else {
            updatedProduct = await Product.findOneAndUpdate(
              { _id: prod._id, isActive: true, availability: 'in_stock' },
              { $set: { 'source.lastSyncedAt': new Date() } },
              { new: true, session }
            );
          }
        }

        if (!updatedProduct) {
          const stockInfo = prod.stock !== undefined ? `Available: ${prod.stock}` : `Status: ${prod.availability}`;
          throw new Error(`Insufficient stock or availability for product "${prod.name}". ${stockInfo}, Requested: ${item.quantity}`);
        }

        const itemPrice = prod.price;
        subtotal += itemPrice * item.quantity;

        orderItems.push({
          itemType: 'legacy',
          product: prod._id,
          name: prod.name,
          sku: prod.sku,
          price: itemPrice,
          currency: 'PKR',
          quantity: item.quantity,
          image: prod.image,
          slug: prod.slug,
          fulfillmentMode: 'internal'
        });
      }
    }

    // 4. Save the snapshotted order to database
    const order = new Order({
      user: req.user.id,
      items: orderItems,
      shippingAddress: {
        fullName: shippingAddress.fullName.trim(),
        addressLine: shippingAddress.addressLine.trim(),
        city: shippingAddress.city.trim(),
        postalCode: shippingAddress.postalCode.trim(),
        country: shippingAddress.country.trim()
      },
      paymentMethod: 'Cash on Delivery',
      subtotal,
      status: 'pending'
    });

    await order.save({ session });

    // 5. Empty user's cart in the database
    await Cart.deleteOne({ user: req.user.id }, { session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, data: order });

  } catch (err) {
    // Rollback atomic stock and creations
    await session.abortTransaction();
    session.endSession();
    
    if (err.code === 'PRICE_CHANGED') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'PRICE_CHANGED',
          message: err.message,
          oldPrice: err.oldPrice,
          newPrice: err.newPrice,
          productName: err.productName
        }
      });
    }

    res.status(400).json({ success: false, error: { message: err.message } });
  }
};

// Get current user's orders list
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to retrieve orders.' } });
  }
};

// Get single order details (verifying ownership)
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { message: 'Order not found.' } });
    }

    // Verify ownership
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: { message: 'You are not authorized to view this order.' } });
    }

    res.status(200).json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to retrieve order details.' } });
  }
};

// Get all platform orders (Admin-only)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to retrieve all orders.' } });
  }
};

// Update order status (Admin-only)
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: { message: 'Invalid or missing status value.' } });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { message: 'Order not found.' } });
    }

    const currentStatus = order.status;
    const newStatus = status;

    // Transition constraints
    const allowedTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: []
    };

    if (currentStatus !== newStatus && !allowedTransitions[currentStatus].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: { message: `Cannot transition order status from "${currentStatus}" to "${newStatus}".` }
      });
    }

    order.status = newStatus;
    await order.save();

    res.status(200).json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to update order status.' } });
  }
};
