const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  type: {
    type: String,
    enum: ['bank_outage', 'platform_issue', 'provider_down', 'high_demand', 'maintenance', 'other'],
    default: 'other',
  },
  instance: { type: String, enum: ['venezuela', 'internacional', 'all'], default: 'all' },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  // How much to relax thresholds (multiplier: 2 = double the allowed time)
  relaxFactor: { type: Number, default: 2 },
  active: { type: Boolean, default: true },
  createdBy: { type: String },
}, { timestamps: true });

incidentSchema.index({ startedAt: 1, endedAt: 1 });
incidentSchema.index({ instance: 1 });

/**
 * Find incidents that overlap with a given time range
 */
incidentSchema.statics.findOverlapping = async function (timestamp, instance) {
  const query = {
    active: true,
    startedAt: { $lte: timestamp },
    endedAt: { $gte: timestamp },
  };
  // Match instance or 'all'
  query.$or = [
    { instance: 'all' },
    { instance: instance },
  ];
  return this.find(query);
};

module.exports = mongoose.model('Incident', incidentSchema);
