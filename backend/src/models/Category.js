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
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
