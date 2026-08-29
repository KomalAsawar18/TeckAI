const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  itemType: {
    type: String,
    enum: ['legacy', 'canonical'],
    default: 'legacy'
  },
  // Legacy Product reference
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  // Canonical Product & Offer references
  canonicalProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CanonicalProduct'
  },
  productOffer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductOffer'
  },
  variant: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  priceSnapshot: {
    type: Number
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    default: 1
  }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    unique: true,
    index: true
  },
  items: [cartItemSchema]
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.model('Cart', cartSchema);
