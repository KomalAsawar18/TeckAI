const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Create a new order (Checkout)
exports.createOrder = async (req, res) => {
  const { shippingAddress } = req.body;

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
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product').session(session);
    if (!cart || cart.items.length === 0) {
      throw new Error('Your cart is empty.');
    }

    const orderItems = [];
    let subtotal = 0;

    // 3. Process each cart item with atomic conditional stock checks
    for (const item of cart.items) {
      const prod = item.product;
      if (!prod) {
        throw new Error('One or more products in your cart no longer exist.');
      }

      // Check active status
      if (!prod.isActive) {
        throw new Error(`Product "${prod.name}" is currently unavailable.`);
      }

      // Atomically check stock and decrement in one step
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: prod._id, stock: { $gte: item.quantity }, isActive: true },
        { $inc: { stock: -item.quantity } },
        { new: true, session }
      );

      if (!updatedProduct) {
        throw new Error(`Insufficient stock for product "${prod.name}". Available: ${prod.stock}, Requested: ${item.quantity}`);
      }

      // Authoritative database price & snapshotted details
      const itemPrice = prod.price;
      subtotal += itemPrice * item.quantity;

      orderItems.push({
        product: prod._id,
        name: prod.name,
        sku: prod.sku,
        price: itemPrice,
        quantity: item.quantity,
        image: prod.image,
        slug: prod.slug
      });
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
