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
    required: true, 
    default: 0, 
    min: 0 
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
  }]
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

// Compound index for price filtering within active products
productSchema.index({ isActive: 1, price: 1 });

module.exports = mongoose.model('Product', productSchema);
