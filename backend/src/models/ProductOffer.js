const mongoose = require('mongoose');

const productOfferSchema = new mongoose.Schema({
  canonicalProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CanonicalProduct',
    required: true,
    index: true
  },
  seller: {
    name: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['retailer', 'business', 'individual'],
      trim: true
    },
    location: {
      type: String,
      trim: true
    }
  },
  source: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    listingId: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['manual', 'api', 'feed', 'scraper'],
      trim: true
    }
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  currency: {
    type: String,
    default: 'PKR',
    trim: true
  },
  availability: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'pre_order', 'unknown'],
    default: 'unknown',
    index: true
  },
  stock: {
    type: Number,
    min: 0
  },
  condition: {
    type: String,
    enum: ['new', 'refurbished', 'used', 'open_box'],
    default: 'new',
    index: true
  },
  variant: {
    color: {
      type: String,
      trim: true
    },
    configuration: {
      type: String,
      trim: true
    }
  },
  sourceUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        try {
          const u = new URL(v);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      },
      message: 'Invalid sourceUrl format'
    }
  },
  affiliateUrl: {
    type: String,
    trim: true
  },
  affiliate: {
    enabled: {
      type: Boolean,
      default: false
    },
    url: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          try {
            const u = new URL(v);
            return u.protocol === 'http:' || u.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'Invalid affiliate URL format'
      }
    },
    network: {
      type: String,
      trim: true
    },
    program: {
      type: String,
      trim: true
    },
    campaign: {
      type: String,
      trim: true
    },
    lastVerifiedAt: {
      type: Date
    }
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true,
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

// Pre-validate hook to synchronize sourceUrl / source.url if provided
productOfferSchema.pre('validate', function(next) {
  if (this.source && this.source.url && !this.sourceUrl) {
    this.sourceUrl = this.source.url;
  } else if (this.sourceUrl && this.source && !this.source.url) {
    this.source.url = this.sourceUrl;
  }
  next();
});

// Compound unique index ensuring no duplicate external offers for the same source + listingId
productOfferSchema.index(
  { 'source.name': 1, 'source.listingId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'source.name': { $type: 'string' },
      'source.listingId': { $type: 'string' }
    }
  }
);

// Compound index to quickly fetch active offers for a canonical product sorted by price
productOfferSchema.index(
  { canonicalProduct: 1, isActive: 1, price: 1 }
);

module.exports = mongoose.model('ProductOffer', productOfferSchema);
