const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  slug: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  description: { 
    type: String 
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

module.exports = mongoose.model('Category', categorySchema);
