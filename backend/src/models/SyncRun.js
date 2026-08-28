const mongoose = require('mongoose');

const SyncRunSchema = new mongoose.Schema({
  source: {
    type: String,
    required: true,
    enum: ['EEZEPC', 'CZONE', 'OTHER'],
    default: 'EEZEPC'
  },
  syncRunId: {
    type: String,
    required: true,
    unique: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  durationMs: {
    type: Number
  },
  status: {
    type: String,
    required: true,
    enum: ['running', 'success', 'failed', 'skipped'],
    default: 'running'
  },
  pagesProcessed: {
    type: Number,
    default: 0
  },
  fetched: {
    type: Number,
    default: 0
  },
  supported: {
    type: Number,
    default: 0
  },
  skipped: {
    type: Number,
    default: 0
  },
  created: {
    type: Number,
    default: 0
  },
  updated: {
    type: Number,
    default: 0
  },
  failed: {
    type: Number,
    default: 0
  },
  errorReason: {
    type: String
  }
}, { timestamps: true });

// Basic indexes
SyncRunSchema.index({ startedAt: -1 });
SyncRunSchema.index({ source: 1, status: 1 });

module.exports = mongoose.model('SyncRun', SyncRunSchema);
