/**
 * Payments Routes
 * POST /api/payments       — encrypt card/phone → save payment (protected)
 * GET  /api/payments       — aggregation pipeline join with users (admin only)
 * GET  /api/payments/mine  — logged-in user's own payments
 */

const express = require('express');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const { encrypt, decrypt } = require('../utils/encryption');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Generate a unique transaction ID
 */
const generateTransactionId = () => {
  return 'TXN-' + crypto.randomBytes(8).toString('hex').toUpperCase();
};

// ─── POST /api/payments ──────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { amount, paymentMethodType, cardNumber, phone } = req.body;

    if (!amount || !paymentMethodType) {
      return res.status(400).json({
        success: false,
        message: 'Amount and payment method type are required.',
      });
    }

    // Encrypt sensitive fields before storing
    const paymentMethod = { type: paymentMethodType };

    if (cardNumber) {
      paymentMethod.cardNumberEncrypted = encrypt(cardNumber);
    }
    if (phone) {
      paymentMethod.phoneEncrypted = encrypt(phone);
    }

    const payment = new Payment({
      userId: req.user.id,
      amount: parseFloat(amount),
      paymentMethod,
      transactionId: generateTransactionId(),
    });
    await payment.save();

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      data: {
        _id: payment._id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
      },
    });
  } catch (err) {
    console.error('[PAYMENTS] POST error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to record payment.' });
  }
});

// ─── GET /api/payments/mine ──────────────────────────────────────────────────
// Logged-in user's own payment history
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 });

    const result = payments.map((p) => {
      const obj = p.toObject();
      // Mask card — show only last 4 digits
      if (obj.paymentMethod.cardNumberEncrypted) {
        try {
          const full = decrypt(obj.paymentMethod.cardNumberEncrypted);
          obj.paymentMethod.maskedCard = '**** **** **** ' + full.slice(-4);
        } catch {
          obj.paymentMethod.maskedCard = '**** **** **** ****';
        }
      }
      delete obj.paymentMethod.cardNumberEncrypted;
      delete obj.paymentMethod.phoneEncrypted;
      return obj;
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('[PAYMENTS] MINE error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch your payments.' });
  }
});

// ─── GET /api/payments ───────────────────────────────────────────────────────
// Admin only: aggregation pipeline join payments with user details
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const mongoose = require('mongoose');

    const results = await mongoose.connection.db
      .collection('payments')
      .aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userDetails',
          },
        },
        { $unwind: '$userDetails' },
        { $sort: { createdAt: -1 } },
        {
          $project: {
            amount: 1,
            transactionId: 1,
            status: 1,
            createdAt: 1,
            'paymentMethod.type': 1,
            'paymentMethod.cardNumberEncrypted': 1,
            'paymentMethod.phoneEncrypted': 1,
            'userDetails.name': 1,
            'userDetails.email': 1,
            'userDetails.role': 1,
          },
        },
      ])
      .toArray();

    // Decrypt sensitive fields and mask card numbers
    const decrypted = results.map((p) => {
      let maskedCard = null;
      let phone = null;

      if (p.paymentMethod?.cardNumberEncrypted) {
        try {
          const full = decrypt(p.paymentMethod.cardNumberEncrypted);
          maskedCard = '**** **** **** ' + full.slice(-4);
        } catch {
          maskedCard = '**** **** **** ****';
        }
      }
      if (p.paymentMethod?.phoneEncrypted) {
        try {
          phone = decrypt(p.paymentMethod.phoneEncrypted);
        } catch {
          phone = '***masked***';
        }
      }

      return {
        _id: p._id,
        amount: p.amount,
        transactionId: p.transactionId,
        status: p.status,
        createdAt: p.createdAt,
        paymentMethodType: p.paymentMethod?.type,
        maskedCard,
        phone,
        user: {
          name: p.userDetails?.name,
          email: p.userDetails?.email,
          role: p.userDetails?.role,
        },
      };
    });

    res.status(200).json({ success: true, data: decrypted });
  } catch (err) {
    console.error('[PAYMENTS] GET (admin) error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch payments.' });
  }
});

module.exports = router;
