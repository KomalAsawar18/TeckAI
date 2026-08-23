const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  slug: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  sku: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
    index: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true, 
    min: 0,
    index: true
  },
  originalPrice: { 
    type: Number, 
    min: 0 
  },
  currency: { 
    type: String, 
    default: 'PKR' 
  },
  stock: { 
    type: Number, 
    min: 0 
  },
  availability: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'unknown'],
    default: 'unknown',
    index: true
  },
  images: [{ 
    type: String 
  }],
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    required: true,
    index: true 
  },
  brand: { 
    type: String, 
    required: true, 
    trim: true,
    index: true 
  },
  rating: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 5 
  },
  reviewCount: { 
    type: Number, 
    default: 0 
  },
  isFeatured: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  // Flexible specifications structure (mixed types: numbers, booleans, arrays, strings)
  specifications: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  },
  tags: [{ 
    type: String 
  }],
  condition: {
    type: String,
    enum: ['new', 'refurbished', 'used'],
    default: 'new',
    index: true
  },
  source: {
    type: {
      type: String,
      enum: ['manual', 'api', 'feed', 'scraper'],
      trim: true
    },
    name: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) { return !v || v.trim().length > 0; },
        message: 'Source name cannot be empty'
      }
    },
    listingId: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) { return !v || v.trim().length > 0; },
        message: 'Listing ID cannot be empty'
      }
    },
    url: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^(https?:\/\/)/i.test(v);
        },
        message: 'URL must use http or https protocol'
      }
    },
    lastSyncedAt: {
      type: Date
    }
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

// Pre-validate hook to omit empty strings and objects from nested metadata
productSchema.pre('validate', function(next) {
  if (this.source) {
    if (this.source.name === '') this.source.name = undefined;
    if (this.source.listingId === '') this.source.listingId = undefined;
    if (this.source.url === '') this.source.url = undefined;
    if (this.source.type === '') this.source.type = undefined;
    
    // Check if source object has any populated fields
    const sourceObj = this.source.toObject ? this.source.toObject() : this.source;
    const hasKeys = Object.keys(sourceObj).some(key => this.source[key] !== undefined && key !== '_id');
    if (!hasKeys) {
      this.source = undefined;
    }
  }
  
  if (this.seller) {
    if (this.seller.name === '') this.seller.name = undefined;
    if (this.seller.type === '') this.seller.type = undefined;
    if (this.seller.location === '') this.seller.location = undefined;
    
    // Check if seller object has any populated fields
    const sellerObj = this.seller.toObject ? this.seller.toObject() : this.seller;
    const hasKeys = Object.keys(sellerObj).some(key => this.seller[key] !== undefined && key !== '_id');
    if (!hasKeys) {
      this.seller = undefined;
    }
  }
  next();
});

// Compound index for price filtering within active products
productSchema.index({ isActive: 1, price: 1 });

// Partial unique compound index for source identity validation
productSchema.index(
  { 'source.name': 1, 'source.listingId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'source.name': { $type: 'string' },
      'source.listingId': { $type: 'string' }
    }
  }
);

module.exports = mongoose.model('Product', productSchema);
