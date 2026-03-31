/**
 * Message Model
 * Stores encrypted message content and optional file attachments (Buffer).
 * Indexes on fromUserId, toUserId, createdAt for fast conversation queries.
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // AES-256 encrypted message content stored as hex string
    contentEncrypted: {
      type: String,
      default: null,
    },
    // Binary file attachment stored as Buffer in MongoDB
    fileAttachment: {
      filename: { type: String, default: null },
      data: { type: Buffer, default: null },
      mimetype: { type: String, default: null },
    },
  },
  { timestamps: true }
);

// Index for fast conversation history lookups
messageSchema.index({ fromUserId: 1, toUserId: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
