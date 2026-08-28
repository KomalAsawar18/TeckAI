const mongoose = require('mongoose');

const offerClickSchema = new mongoose.Schema({
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductOffer',
    required: true,
    index: true
  },
  canonicalProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CanonicalProduct',
    required: true,
    index: true
  },
  sellerName: {
    type: String,
    trim: true
  },
  sourceName: {
    type: String,
    trim: true
  },
  affiliateUsed: {
    type: Boolean,
    default: false
  },
  destinationType: {
    type: String,
    enum: ['affiliate', 'source'],
    required: true
  },
  destinationHost: {
    type: String,
    trim: true,
    lowercase: true
  },
  campaign: {
    type: String,
    trim: true
  },
  context: {
    type: String,
    enum: ['product_page', 'comparison', 'ai_recommendation', 'search', 'unknown'],
    default: 'unknown',
    index: true
  },
  clickedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
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

// Index to aggregate offer clicks over time
offerClickSchema.index({ offer: 1, clickedAt: -1 });
offerClickSchema.index({ canonicalProduct: 1, clickedAt: -1 });

module.exports = mongoose.model('OfferClick', offerClickSchema);
