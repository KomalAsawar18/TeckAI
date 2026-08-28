const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant']
  },
  content: {
    type: String,
    required: true
  },
  recommendedProductIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CanonicalProduct'
  }],
  actionIntent: {
    type: String,
    enum: ['ask_details', 'cheaper_alternatives', 'none'],
    default: 'none'
  }
}, {
  timestamps: true // Gives createdAt for messages implicitly
});

const aiConversationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Quickly find conversations by user
  },
  title: {
    type: String,
    default: 'New Chat'
  },
  messages: [messageSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('AIConversation', aiConversationSchema);
