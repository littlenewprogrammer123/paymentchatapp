/**
 * ChatPage — Real-time encrypted messaging
 * Features:
 *  - Socket.io connection with JWT
 *  - Select target user from list
 *  - Send text messages via socket (emit send_message)
 *  - Send file attachments as ArrayBuffer (emit send_file)
 *  - Load chat history from API on mount/user change
 *  - Listen for receive_message in real-time
 *  - Online/offline user status tracking
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { initSocket, disconnectSocket } from '../utils/socket';
import api from '../utils/api';
import './ChatPage.css';

const ChatPage = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [error, setError] = useState('');
  const [fileUploading, setFileUploading] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeChatRef = useRef(null);

  // Update active chat ref when selected user changes
  useEffect(() => {
    activeChatRef.current = selectedUser;
  }, [selectedUser]);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ── Load all users for selection ───────────────────────────────────────────
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/auth/users');
        const fetchedUsers = res.data.data;
        // Deduplicate users by _id
        setUsers(prevUsers => {
          const merged = [...prevUsers, ...fetchedUsers];
          const unique = merged.filter(
            (user, index, self) => index === self.findIndex(u => u._id === user._id)
          );
          return unique;
        });
      } catch (err) {
        setError('Failed to load users.');
      }
    };
    fetchUsers();
  }, []); // Empty dependency array - only runs once

  // ── Initialize Socket.io ───────────────────────────────────────────────────
  useEffect(() => {
    const socket = initSocket();
    if (!socket) {
      navigate('/login');
      return;
    }
    socketRef.current = socket;

    // Listen for incoming messages
    socketRef.current.on('receive_message', (msg) => {
      // Use ref to get current active chat, avoiding stale closure
      const currentActiveChat = activeChatRef.current;
      if (
        currentActiveChat &&
        (msg.fromUserId === currentActiveChat._id || msg.toUserId === currentActiveChat._id)
      ) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    // Listen for sent confirmation
    socketRef.current.on('message_sent', (msg) => {
      // Already added optimistically, skip duplicates by _id
      setMessages((prev) => {
        const exists = prev.find((m) => m._id === msg._id);
        return exists ? prev : [...prev, msg];
      });
    });

    // Track online/offline status
    socketRef.current.on('user_online', ({ userId }) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });
    socketRef.current.on('user_offline', ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    socketRef.current.on('error_event', ({ message }) => {
      setError(message);
      setTimeout(() => setError(''), 4000);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off('receive_message');
        socketRef.current.off('message_sent');
        socketRef.current.off('user_online');
        socketRef.current.off('user_offline');
        socketRef.current.off('error_event');
      }
    };
  }, []); // Empty dependency array - runs only once

  // ── Load message history when user is selected ────────────────────────────
  const loadHistory = useCallback(async (targetUser) => {
    if (!targetUser) return;
    setHistoryLoading(true);
    setMessages([]);
    try {
      const res = await api.get(`/messages/${targetUser._id}`);
      setMessages(res.data.data);
    } catch (err) {
      setError('Failed to load chat history.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    loadHistory(u);
    setNewMessage('');
  };

  // ── Send text message via Socket.io ──────────────────────────────────────
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;
    if (!socketRef.current?.connected) {
      setError('Socket not connected. Please refresh.');
      return;
    }

    setLoading(true);
    socketRef.current.emit('send_message', {
      toUserId: selectedUser._id,
      content: newMessage.trim(),
    });

    setNewMessage('');
    setLoading(false);
  };

  // ── Send file attachment as ArrayBuffer ───────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedUser) return;
    if (!socketRef.current?.connected) {
      setError('Socket not connected. Please refresh.');
      return;
    }

    setFileUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();

      socketRef.current.emit('send_file', {
        toUserId: selectedUser._id,
        fileBuffer: arrayBuffer,
        filename: file.name,
        mimetype: file.type || 'application/octet-stream',
      });
    } catch (err) {
      setError('Failed to read file.');
    } finally {
      setFileUploading(false);
      e.target.value = null;
    }
  };

  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat-page">
      {/* ── Sidebar ── */}
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-user-info">
            <div className="avatar">{user.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="sidebar-username">{user.name}</div>
              <div className="sidebar-role">{user.role}</div>
            </div>
          </div>
        </div>

        <div className="sidebar-search">
          <span className="search-label">Conversations</span>
        </div>

        <div className="users-list">
          {users.map((u) => (
            <div
              key={u._id}
              id={`user-${u._id}`}
              className={`user-item ${selectedUser?._id === u._id ? 'active' : ''}`}
              onClick={() => handleSelectUser(u)}
            >
              <div className="user-item-avatar">
                {u.name[0].toUpperCase()}
                <span className={`status-dot ${onlineUsers.has(u._id) ? 'online' : ''}`} />
              </div>
              <div className="user-item-info">
                <span className="user-item-name">{u.name}</span>
                <span className="user-item-email">{u.email}</span>
              </div>
              <span className={`role-badge role-${u.role}`}>{u.role}</span>
            </div>
          ))}
          {users.length === 0 && (
            <div className="no-users">No other users yet. Register more accounts to chat.</div>
          )}
        </div>

        {/* Sidebar Footer with Navigation */}
        <div className="sidebar-footer">
          <div className="sidebar-divider"></div>
          <div className="sidebar-nav">
            {user.role === 'admin' && (
              <Link to="/payments" className="sidebar-nav-btn payments-btn" title="Payments Dashboard">
                💳 Payments
              </Link>
            )}
            <Link to="/make-payment" className="sidebar-nav-btn payment-btn" title="Make Payment">
              💰 Make Payment
            </Link>
            <button onClick={handleLogout} className="sidebar-nav-btn logout-btn" title="Logout">
              🚪 Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <main className="chat-main">
        {!selectedUser ? (
          <div className="chat-placeholder">
            <div className="placeholder-icon">💬</div>
            <h2>Select a conversation</h2>
            <p>Choose a user from the sidebar to start chatting securely</p>
            <div className="placeholder-features">
              <span>🔐 AES-256 Encrypted</span>
              <span>⚡ Real-time</span>
              <span>📁 File Transfer</span>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="chat-header-user">
                <div className="avatar">{selectedUser.name[0].toUpperCase()}</div>
                <div>
                  <div className="chat-header-name">{selectedUser.name}</div>
                  <div className="chat-header-status">
                    {onlineUsers.has(selectedUser._id) ? '🟢 Online' : '⚫ Offline'}
                  </div>
                </div>
              </div>
              <div className="chat-header-badge">🔐 End-to-end encrypted</div>
            </div>

            {/* Messages */}
            <div className="messages-area">
              {historyLoading && (
                <div className="messages-loading">Loading history...</div>
              )}

              {messages.map((msg, i) => {
                const isMine = msg.fromUserId === user._id;
                return (
                  <div
                    key={msg._id || i}
                    className={`message-bubble ${isMine ? 'sent' : 'received'}`}
                  >
                    {msg.type === 'file' || msg.hasFile ? (
                      <div className="file-message">
                        <span className="file-icon">📎</span>
                        <div className="file-info">
                          <span className="file-name">{msg.filename}</span>
                          <a
                            href={`http://localhost:5000${msg.fileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="file-download"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="message-text">{msg.content}</p>
                    )}
                    <span className="message-time">{formatTime(msg.createdAt)}</span>
                  </div>
                );
              })}

              {messages.length === 0 && !historyLoading && (
                <div className="no-messages">
                  No messages yet. Say hello! 👋
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {error && <div className="chat-error">{error}</div>}

            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="file-input"
              />
              <button
                type="button"
                id="attach-file-btn"
                className="attach-btn"
                title="Attach file"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileUploading}
              >
                {fileUploading ? '⏳' : '📎'}
              </button>
              <input
                id="message-input"
                type="text"
                className="message-input"
                placeholder="Type a message... (AES-256 encrypted)"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(e)}
              />
              <button
                id="send-btn"
                type="submit"
                className="send-btn"
                disabled={loading || !newMessage.trim()}
              >
                ➤
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
};

export default ChatPage;
