/**
 * Socket.io client singleton with JWT authentication.
 * Creates socket on demand and reuses same instance.
 */

import { io } from 'socket.io-client';

let socket = null;

/**
 * Initialize socket connection with JWT token
 * @returns {Socket} socket instance
 */
export const initSocket = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  if (socket && socket.connected) return socket;

  socket = io('http://localhost:5000', {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Socket connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔴 Socket disconnected:', reason);
  });

  return socket;
};

/**
 * Get the existing socket instance
 */
export const getSocket = () => socket;

/**
 * Disconnect and reset the socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default { initSocket, getSocket, disconnectSocket };
