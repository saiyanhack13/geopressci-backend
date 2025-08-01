const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reportSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'user_registrations',
      'revenue',
      'orders',
      'subscriptions',
      'user_activity',
      'pressing_performance',
      'service_analytics',
      'custom'
    ]
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  period: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  filters: {
    type: Map,
    of: Schema.Types.Mixed
  },
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  generatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  isScheduled: {
    type: Boolean,
    default: false
  },
  schedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
    },
    lastRun: Date,
    nextRun: Date
  },
  format: {
    type: String,
    enum: ['json', 'csv', 'pdf', 'xlsx'],
    default: 'json'
  },
  fileUrl: String,
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
reportSchema.index({ type: 1, 'period.start': 1, 'period.end': 1 });
reportSchema.index({ 'period.start': 1, 'period.end': 1 });
reportSchema.index({ generatedBy: 1, createdAt: -1 });

module.exports = mongoose.model('AdminReport', reportSchema);
