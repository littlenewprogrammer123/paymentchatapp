/**
 * Payment Model
 * Stores payment records with encrypted card and phone numbers.
 * Indexes on userId and createdAt for efficient user payment queries.
 */

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    paymentMethod: {
      type: {
        type: String,
        enum: ['credit_card', 'debit_card', 'upi', 'net_banking'],
        required: true,
      },
      // AES-256 encrypted card number stored as hex
      cardNumberEncrypted: {
        type: String,
        default: null,
      },
      // AES-256 encrypted phone number for UPI
      phoneEncrypted: {
        type: String,
        default: null,
      },
    },
    // Unique transaction reference
    transactionId: {
      type: String,
      unique: true,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'success',
    },
  },
  { timestamps: true }
);

// Indexes for fast payment lookup and aggregation
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
