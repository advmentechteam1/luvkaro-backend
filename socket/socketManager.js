let ioInstance = null;
const onlineUsers = new Map(); // userId -> Set of socketIds

// Helper to filter out phone numbers and social IDs from free socket broadcast
function detectRestrictedContact(rawText) {
  if (!rawText) return false;
  const digits = rawText.replace(/\D/g, '');
  if (digits.length >= 6) return true;
  if (/@\w{2,}/i.test(rawText) || /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(rawText)) return true;
  if (/\b(insta|instagram|snap|snapchat|telegram|whatsapp|wa\.me|facebook|fb\s*id|number\s*lo|number\s*do|call\s*me|dm\s*me|https?:\/\/|www\.)\b/i.test(rawText)) return true;
  return false;
}

const initSocketManager = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`⚡ Real-time Socket connected: ${socket.id}`);

    // Register logged-in user into their personal room
    socket.on('register_user', (userId) => {
      if (!userId) return;
      const uid = userId.toString();
      socket.userId = uid;
      socket.join(`user_${uid}`);

      if (!onlineUsers.has(uid)) {
        onlineUsers.set(uid, new Set());
      }
      onlineUsers.get(uid).add(socket.id);

      io.emit('online_users', Array.from(onlineUsers.keys()));
    });

    // Join Admin live monitoring room
    socket.on('join_admin', () => {
      socket.join('admin_room');
    });

    // Join a conversation room between two users
    socket.on('join_chat', (room) => {
      if (room) {
        socket.join(room);
      }
    });

    // Instant real-time message relay across sockets
    socket.on('send_chat_message', (payload) => {
      if (!payload || !payload.recipientId || !payload.text) return;
      const recipientId = payload.recipientId.toString();
      const senderId = (socket.userId || payload.senderId || '').toString();

      // Enforce anti-contact sharing on live socket
      if (detectRestrictedContact(payload.text) && !payload.isPremium) {
        socket.emit('message_rejected', {
          reason: 'Phone number ya Social Media ID share karna Free chat me allowed nahi hai. Recharge to VIP!',
        });
        return;
      }

      const nowTime = payload.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const msgData = {
        partnerId: senderId,
        senderId,
        senderName: payload.senderName || 'Match',
        senderAvatar: payload.senderAvatar || '',
        text: payload.text,
        type: 'received',
        time: nowTime,
        messageId: payload.messageId || `rt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };

      console.log(`[Socket] 💬 Instant message from ${senderId} -> ${recipientId}: "${payload.text}"`);

      // Emit directly to recipient's user room
      io.to(`user_${recipientId}`).emit('receive_message', msgData);

      // Also emit to conversation room if active
      if (senderId && recipientId) {
        const convRoom = `chat_${[senderId, recipientId].sort().join('_')}`;
        socket.to(convRoom).emit('receive_message', msgData);
      }
    });

    // Real-time typing indicator
    socket.on('typing', ({ partnerId, senderId, senderName }) => {
      if (partnerId) {
        io.to(`user_${partnerId}`).emit('user_typing', { senderId, senderName });
      }
    });

    socket.on('stop_typing', ({ partnerId, senderId }) => {
      if (partnerId) {
        io.to(`user_${partnerId}`).emit('user_stop_typing', { senderId });
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId && onlineUsers.has(socket.userId)) {
        const set = onlineUsers.get(socket.userId);
        set.delete(socket.id);
        if (set.size === 0) {
          onlineUsers.delete(socket.userId);
        }
        io.emit('online_users', Array.from(onlineUsers.keys()));
      }
    });
  });
};

const emitToUser = (userId, event, payload) => {
  if (ioInstance && userId) {
    ioInstance.to(`user_${userId.toString()}`).emit(event, payload);
  }
};

const emitToAdmin = (event, payload) => {
  if (ioInstance) {
    ioInstance.to('admin_room').emit(event, payload);
  }
};

const broadcastEvent = (event, payload) => {
  if (ioInstance) {
    ioInstance.emit(event, payload);
  }
};

const getOnlineUserIds = () => Array.from(onlineUsers.keys());

module.exports = {
  initSocketManager,
  emitToUser,
  emitToAdmin,
  broadcastEvent,
  getOnlineUserIds,
};

