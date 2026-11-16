const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../models/dataStore');

let io = null;

function initIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = new Set(config.clientOrigins || []);
        if (allowed.has(origin)) return callback(null, true);

        if (config.nodeEnv !== 'production') {
          const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
          const isLan = /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
          if (isLocal || isLan) return callback(null, true);
        }
        return callback(new Error(`CORS blocked Socket.io origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 20000,
    pingInterval: 10000
  });

  // Socket Authentication Middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = db.users.get(decoded.id || decoded.uid);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (user.suspended || user.isSuspended) {
        return next(new Error('Authentication error: Account suspended'));
      }

      socket.user = {
        id: user.id,
        name: user.name,
        role: user.role || 'user',
        isHelper: Boolean(user.isHelper)
      };

      return next();
    } catch (err) {
      return next(new Error(`Authentication error: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    // 1. Every user joins their personal notification room
    socket.join(`user:${userId}`);

    // 2. Admins join admin room
    if (socket.user.role === 'admin') {
      socket.join('admin');
    }

    // 3. Helpers join available pool if approved and available
    const helper = db.helpers.get(userId);
    if (helper && helper.status === 'approved' && helper.isAvailable !== false) {
      socket.join('helpers:available');
    }

    // Join Request Room
    socket.on('request:join', ({ requestId }, callback) => {
      const request = db.requests.get(requestId);
      if (!request) {
        if (callback) callback({ error: 'RequestNotFound' });
        return;
      }

      const isRequester = request.requesterId === userId;
      const isAcceptedHelper = request.acceptedHelperId === userId;
      const isAdmin = socket.user.role === 'admin';
      const isSearchingHelper = request.status === 'searching' && socket.user.isHelper;

      if (!isRequester && !isAcceptedHelper && !isAdmin && !isSearchingHelper) {
        if (callback) callback({ error: 'Forbidden', message: 'Not authorized for this request room.' });
        return;
      }

      socket.join(`request:${requestId}`);
      if (callback) callback({ success: true, room: `request:${requestId}` });
    });

    // Leave Request Room
    socket.on('request:leave', ({ requestId }) => {
      socket.leave(`request:${requestId}`);
    });

    // Live In-App Chat Messaging
    socket.on('chat:send', ({ requestId, text, type = 'text', mediaUrl, durationSeconds }, callback) => {
      const chat = db.chats.get(requestId);
      if (!chat) {
        if (callback) callback({ error: 'ChatNotFound' });
        return;
      }

      if (!chat.active) {
        if (callback) callback({ error: 'ChatLocked', message: 'Assistance session has ended. Chat is closed.' });
        return;
      }

      if (!chat.participants.includes(userId) && socket.user.role !== 'admin') {
        if (callback) callback({ error: 'Forbidden', message: 'Not a participant in this conversation.' });
        return;
      }

      const msg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: userId,
        senderName: socket.user.name,
        type: type || 'text',
        text: text ? String(text).trim() : '',
        mediaUrl: mediaUrl || null,
        durationSeconds: durationSeconds || null,
        readBy: [userId],
        createdAt: new Date().toISOString()
      };

      const messages = db.messages.get(requestId) || [];
      messages.push(msg);
      db.messages.set(requestId, messages);

      chat.lastMessage = msg.type === 'voice_note' ? '🎤 Voice Note' : msg.text;
      chat.lastMessageAt = msg.createdAt;
      db.chats.set(requestId, chat);

      db.saveMessages();
      db.saveChats();

      // Broadcast to room
      io.to(`request:${requestId}`).emit('chat:message', { requestId, message: msg });
      if (callback) callback({ success: true, message: msg });
    });

    // Typing indicators
    socket.on('chat:typing', ({ requestId, isTyping }) => {
      socket.to(`request:${requestId}`).emit('chat:typing', {
        requestId,
        userId,
        userName: socket.user.name,
        isTyping: Boolean(isTyping)
      });
    });

    // Mark messages read
    socket.on('chat:read', ({ requestId }) => {
      const messages = db.messages.get(requestId);
      if (messages) {
        let changed = false;
        messages.forEach(m => {
          m.readBy = m.readBy || [];
          if (!m.readBy.includes(userId)) {
            m.readBy.push(userId);
            changed = true;
          }
        });
        if (changed) {
          db.saveMessages();
          socket.to(`request:${requestId}`).emit('chat:read', { requestId, readerId: userId });
        }
      }
    });

    // Live GPS Location Streaming from Accepted Helper (Phase 3)
    socket.on('helper:location', ({ requestId, lat, lng, accuracy, heading, speed }) => {
      if (typeof lat !== 'number' || typeof lng !== 'number' || !requestId) return;

      const request = db.requests.get(requestId);
      if (!request) return;

      // Must be the accepted helper of an active request
      if (request.acceptedHelperId !== userId) return;
      if (request.status !== 'accepted' && request.status !== 'in_progress') return;

      const locationUpdate = {
        lat,
        lng,
        accuracy: accuracy || 15,
        heading: heading || null,
        speed: speed || null,
        updatedAt: new Date().toISOString()
      };

      request.lastHelperLocation = locationUpdate;
      db.requests.set(requestId, request);

      // Update helper's location in dataStore
      const helper = db.helpers.get(userId);
      if (helper) {
        helper.location = locationUpdate;
        db.helpers.set(userId, helper);
      }

      // Broadcast live position to the request room
      io.to(`request:${requestId}`).emit('helper:location', {
        requestId,
        helperId: userId,
        location: locationUpdate
      });
    });

    // Phase 4: WebRTC Voice Calling Signalling
    socket.on('call:invite', ({ requestId }, callback) => {
      const request = db.requests.get(requestId);
      if (!request || (request.status !== 'accepted' && request.status !== 'in_progress')) {
        if (callback) callback({ error: 'InvalidCallState', message: 'Voice calling is only available during active assistance sessions.' });
        return;
      }

      // Ensure user is participant
      if (request.requesterId !== userId && request.acceptedHelperId !== userId) {
        if (callback) callback({ error: 'Forbidden', message: 'You are not a participant in this request.' });
        return;
      }

      const calleeId = request.requesterId === userId ? request.acceptedHelperId : request.requesterId;
      const callId = `call_${Date.now()}`;

      // Emit incoming call event to recipient user room
      io.to(`user:${calleeId}`).emit('call:incoming', {
        requestId,
        callId,
        callerId: userId,
        callerName: socket.user.name
      });

      if (callback) callback({ success: true, callId, calleeId });
    });

    socket.on('call:accept', ({ requestId, callId, callerId }) => {
      io.to(`user:${callerId}`).emit('call:accepted', { requestId, callId, calleeId: userId });
    });

    socket.on('call:decline', ({ requestId, callId, callerId }) => {
      io.to(`user:${callerId}`).emit('call:declined', { requestId, callId });
    });

    socket.on('call:cancel', ({ requestId, callId, calleeId }) => {
      io.to(`user:${calleeId}`).emit('call:cancelled', { requestId, callId });
    });

    socket.on('call:end', ({ requestId, callId, targetUserId, durationSeconds }) => {
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('call:ended', { requestId, callId, durationSeconds });
      }

      // Save call duration or missed status in chat log
      if (requestId) {
        const secs = durationSeconds || 0;
        const durationText = secs > 0
          ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
          : 'Missed';
        const msg = {
          id: `msg_call_${Date.now()}`,
          senderId: 'system',
          senderName: 'Voice Call',
          type: 'system',
          text: `📞 Voice Call – ${durationText}`,
          createdAt: new Date().toISOString()
        };
        const messages = db.messages.get(requestId) || [];
        messages.push(msg);
        db.messages.set(requestId, messages);
        db.saveMessages();
        io.to(`request:${requestId}`).emit('chat:message', { requestId, message: msg });
      }
    });

    socket.on('call:offer', ({ requestId, callId, targetUserId, sdp }) => {
      io.to(`user:${targetUserId}`).emit('call:offer', { requestId, callId, sdp, fromUserId: userId });
    });

    socket.on('call:answer', ({ requestId, callId, targetUserId, sdp }) => {
      io.to(`user:${targetUserId}`).emit('call:answer', { requestId, callId, sdp, fromUserId: userId });
    });

    socket.on('call:ice', ({ requestId, callId, targetUserId, candidate }) => {
      io.to(`user:${targetUserId}`).emit('call:ice', { requestId, callId, candidate, fromUserId: userId });
    });

    // Helper toggle availability
    socket.on('helpers:toggle-available', ({ isAvailable }) => {
      if (isAvailable) {
        socket.join('helpers:available');
      } else {
        socket.leave('helpers:available');
      }
    });

    socket.on('disconnect', () => {
      // Room cleanups are handled automatically by socket.io
    });
  });

  console.log('[REALTIME] Socket.io server initialized and listening for connections.');
  return io;
}

function emitTo(room, event, payload) {
  if (io) {
    io.to(room).emit(event, payload);
  }
}

function getIO() {
  return io;
}

module.exports = {
  initIO,
  emitTo,
  getIO
};
