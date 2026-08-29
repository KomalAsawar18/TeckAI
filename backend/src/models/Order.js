const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  itemType: {
    type: String,
    enum: ['legacy', 'canonical'],
    default: 'legacy'
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  canonicalProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CanonicalProduct'
  },
  productOffer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductOffer'
  },
  name: {
    type: String,
    required: true
  },
  sku: {
    type: String
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'PKR'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  image: {
    type: String
  },
  slug: {
    type: String
  },
  seller: {
    type: String
  },
  source: {
    type: String
  },
  condition: {
    type: String
  },
  variant: {
    type: mongoose.Schema.Types.Mixed
  },
  fulfillmentMode: {
    type: String,
    enum: ['internal', 'external_supplier', 'affiliate_only'],
    default: 'internal'
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  items: {
    type: [orderItemSchema],
    validate: [v => Array.isArray(v) && v.length > 0, 'Order must contain at least one item']
  },
  shippingAddress: {
    fullName: { type: String, required: true, trim: true },
    addressLine: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true }
  },
  paymentMethod: {
    type: String,
    default: 'Cash on Delivery',
    required: true
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
