const mongoose = require('mongoose');

const canonicalProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    trim: true,
    index: true
  },
  model: {
    type: String,
    trim: true,
    index: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  images: [{
    type: String,
    trim: true
  }],
  // Flexible specifications dictionary for hardware specs (CPU, GPU, RAM, etc.)
  specifications: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Deterministic canonical identifier (e.g. "asus|fa507nv")
  canonicalKey: {
    type: String,
    trim: true
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

// Partial unique index for canonicalKey when present
canonicalProductSchema.index(
  { canonicalKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      canonicalKey: { $type: 'string' }
    }
  }
);

// Compound index on brand and model for lookup
canonicalProductSchema.index(
  { brand: 1, model: 1 }
);

module.exports = mongoose.model('CanonicalProduct', canonicalProductSchema);
