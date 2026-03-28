const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceType: { type: String, required: true },
  issueType: { type: String },
  description: { type: String },
  status: { type: String, enum: ['requested','assigned','in_progress','completed','cancelled'], default: 'requested' },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  basePrice: { type: Number, default: 500 },
  distanceKm: { type: Number, default: 0 },
  finalPrice: { type: Number },
  paymentStatus: { type: String, enum: ['pending','paid','completed'], default: 'pending' },
  paymentMethod: { type: String, enum: ['cash','card','upi','bank'], default: 'cash' },
  paymentDate: { type: Date },
  distanceCharge: { type: Number, default: 0 },
  
  // Provider related fields
  providerEarning: { type: Number, default: 0 }, // amount provider will receive
  providerPaid: { type: Boolean, default: false }, // whether provider confirmed payment received
  providerAccepted: { type: Boolean, default: false }, // provider accepted/started the job
  // OTP verification when provider reaches customer
  otpCode: { type: String }, // hashed or plain depending on security needs
  otpExpiresAt: { type: Date },
  otpVerified: { type: Boolean, default: false },
  
  // Expiration - auto cancels after 10 days if no provider accepts
  expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) } // 10 days from now
}, { timestamps: true });

module.exports = mongoose.model('Service', ServiceSchema);
