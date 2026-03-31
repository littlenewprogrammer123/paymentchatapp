/**
 * Messages Routes
 * POST /api/messages          — encrypt content → save → return
 * GET  /api/messages/:userId  — fetch conversation → decrypt → return
 * GET  /api/messages/file/:id — serve file attachment
 * All routes are protected by JWT authMiddleware.
 */

const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const { encrypt, decrypt } = require('../utils/encryption');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// ─── POST /api/messages ──────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { toUserId, content } = req.body;

    if (!toUserId) {
      return res.status(400).json({ success: false, message: 'toUserId is required.' });
    }
    if (!content && !req.body.fileAttachment) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    // Encrypt content before storing
    const contentEncrypted = content ? encrypt(content) : null;

    const message = new Message({
      fromUserId: req.user.id,
      toUserId,
      contentEncrypted,
    });
    await message.save();

    res.status(201).json({
      success: true,
      message: 'Message sent.',
      data: {
        _id: message._id,
        fromUserId: message.fromUserId,
        toUserId: message.toUserId,
        content, // Return plain content to sender
        createdAt: message.createdAt,
      },
    });
  } catch (err) {
    console.error('[MESSAGES] POST error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

// ─── GET /api/messages/:userId ───────────────────────────────────────────────
// Fetch full conversation between logged-in user and :userId
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId.' });
    }

    // Fetch messages in both directions, sorted oldest first
    const messages = await Message.find({
      $or: [
        { fromUserId: myId, toUserId: userId },
        { fromUserId: userId, toUserId: myId },
      ],
    })
      .sort({ createdAt: 1 })
      .select('-fileAttachment.data'); // Exclude raw file buffer from list

    // Decrypt content before returning
    const decrypted = messages.map((msg) => {
      const obj = msg.toObject();
      obj.content = obj.contentEncrypted ? decrypt(obj.contentEncrypted) : null;
      delete obj.contentEncrypted;

      // Include file attachment metadata (not binary data)
      if (obj.fileAttachment && obj.fileAttachment.filename) {
        obj.hasFile = true;
        obj.fileUrl = `/api/messages/file/${obj._id}`;
      } else {
        obj.hasFile = false;
      }
      delete obj.fileAttachment;

      return obj;
    });

    res.status(200).json({ success: true, data: decrypted });
  } catch (err) {
    console.error('[MESSAGES] GET error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
});

// ─── GET /api/messages/file/:id ──────────────────────────────────────────────
// Stream file attachment from MongoDB
router.get('/file/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message ID.' });
    }

    const message = await Message.findById(id).select('fileAttachment fromUserId toUserId');

    if (!message || !message.fileAttachment || !message.fileAttachment.data) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    // Security: Only sender or recipient can download file
    const myId = req.user.id;
    const isParticipant =
      message.fromUserId.toString() === myId || message.toUserId.toString() === myId;

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.set('Content-Type', message.fileAttachment.mimetype);
    res.set('Content-Disposition', `inline; filename="${message.fileAttachment.filename}"`);
    res.send(message.fileAttachment.data);
  } catch (err) {
    console.error('[MESSAGES] FILE error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve file.' });
  }
});

module.exports = router;
