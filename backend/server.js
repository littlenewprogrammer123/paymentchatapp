/**
 * MERN Interview Demo — Backend Server
 * Features:
 *  - Express REST API (Auth, Messages, Payments)
 *  - Socket.io with JWT authentication on handshake
 *  - MongoDB via Mongoose
 *  - AES-256-CBC encryption for sensitive data
 *  - Real-time messaging with targeted delivery (userId → socketId map)
 *  - Binary file attachment support via Socket.io
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const { encrypt, decrypt } = require('./utils/encryption');
const Message = require('./models/Message');

// ─── Routes ──────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const paymentRoutes = require('./routes/payments');

// ─── App & Server Setup ───────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Socket.io Setup ─────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB for file transfers
});

// ─── CORS Configuration ───────────────────────────────────────────────────────
app.use(
  cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ─── Body Parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// ─── MongoDB Connection ───────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected:', process.env.MONGO_URI);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

// ─── Socket.io — userId to socketId map ──────────────────────────────────────
// Maintains mapping of authenticated userId → socket.id for targeted delivery
const userSocketMap = new Map(); // userId (string) → socketId

// ─── Socket.io — JWT Authentication Middleware ────────────────────────────────
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // Attach user info to socket
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// ─── Socket.io — Connection Handler ──────────────────────────────────────────
io.on('connection', (socket) => {
  const userId = socket.user.id;
  console.log(`🔌 User connected: ${socket.user.name} (${userId}) → socket: ${socket.id}`);

  // Register this user's socket
  userSocketMap.set(userId, socket.id);

  // Broadcast online status
  socket.broadcast.emit('user_online', { userId, name: socket.user.name });

  // ── Event: send_message ─────────────────────────────────────────────────
  socket.on('send_message', async (data) => {
    try {
      const { toUserId, content } = data;

      if (!toUserId || !content) {
        socket.emit('error_event', { message: 'toUserId and content are required.' });
        return;
      }

      // Encrypt before saving to MongoDB
      const contentEncrypted = encrypt(content);

      const message = new Message({
        fromUserId: userId,
        toUserId,
        contentEncrypted,
      });
      await message.save();

      // Build response payload with DECRYPTED content
      const payload = {
        _id: message._id,
        fromUserId: userId,
        fromName: socket.user.name,
        toUserId,
        content, // Plain text — never store, only emit
        createdAt: message.createdAt,
        type: 'text',
      };

      // Emit to target user if online
      const targetSocketId = userSocketMap.get(toUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('receive_message', payload);
        console.log(`📨 Message delivered to user ${toUserId}`);
      } else {
        console.log(`📭 User ${toUserId} is offline — message saved to DB`);
      }

      // Also emit to sender for real-time update
      socket.emit('receive_message', payload);

      // Confirm to sender (separate event for UI feedback)
      socket.emit('message_sent', payload);
    } catch (err) {
      console.error('[SOCKET] send_message error:', err.message);
      socket.emit('error_event', { message: 'Failed to send message.' });
    }
  });

  // ── Event: send_file ────────────────────────────────────────────────────
  socket.on('send_file', async (data) => {
    try {
      const { toUserId, fileBuffer, filename, mimetype } = data;

      if (!toUserId || !fileBuffer || !filename) {
        socket.emit('error_event', { message: 'toUserId, fileBuffer, and filename are required.' });
        return;
      }

      // Convert ArrayBuffer → Node Buffer and save to MongoDB
      const buffer = Buffer.from(fileBuffer);

      const message = new Message({
        fromUserId: userId,
        toUserId,
        contentEncrypted: null,
        fileAttachment: {
          filename,
          data: buffer,
          mimetype: mimetype || 'application/octet-stream',
        },
      });
      await message.save();

      // Build file payload for socket emission (without raw buffer)
      const payload = {
        _id: message._id,
        fromUserId: userId,
        fromName: socket.user.name,
        toUserId,
        filename,
        mimetype,
        fileUrl: `/api/messages/file/${message._id}`,
        createdAt: message.createdAt,
        type: 'file',
      };

      // Emit to target user if online
      const targetSocketId = userSocketMap.get(toUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('receive_message', payload);
        console.log(`📁 File delivered to user ${toUserId}: ${filename}`);
      }

      // Also emit to sender for real-time update
      socket.emit('receive_message', payload);

      // Confirm to sender
      socket.emit('message_sent', payload);
    } catch (err) {
      console.error('[SOCKET] send_file error:', err.message);
      socket.emit('error_event', { message: 'Failed to send file.' });
    }
  });

  // ── Disconnect ──────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    userSocketMap.delete(userId);
    socket.broadcast.emit('user_offline', { userId });
    console.log(`🔴 User disconnected: ${socket.user.name} (${userId})`);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔐 Encryption: AES-256-CBC`);
    console.log(`🔌 Socket.io: enabled with JWT auth`);
  });
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});
