const { v4: uuidv4 } = require('uuid');
const db = require('../models/dataStore');
const notificationService = require('../services/notificationService');
const { emitTo } = require('../realtime/io');

class ChatController {
  // Get chat messages
  async getMessages(req, res) {
    const { id } = req.params; // requestId
    const chat = db.chats.get(id);

    if (!chat) {
      return res.status(404).json({ error: 'ChatNotFound', message: 'Chat room not active.' });
    }

    // Access control: only participants or admins
    const userId = req.user.id;
    if (!chat.participants.includes(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied to this private conversation.' });
    }

    const messages = db.messages.get(id) || [];

    // Mark messages delivered/read by current user
    messages.forEach(msg => {
      if (msg.senderId !== userId) {
        msg.readBy = msg.readBy || [];
        if (!msg.readBy.includes(userId)) {
          msg.readBy.push(userId);
        }
      }
    });

    return res.json({
      chat,
      messages
    });
  }

  // Send message
  async sendMessage(req, res) {
    const { id } = req.params; // requestId
    const chat = db.chats.get(id);

    if (!chat) {
      return res.status(404).json({ error: 'ChatNotFound', message: 'Chat room not found.' });
    }

    // Check if chat is still active (locks when request completes/cancels)
    if (!chat.active) {
      return res.status(400).json({
        error: 'ChatLocked',
        message: 'This assistance session has ended. Private chat is now locked.'
      });
    }

    const userId = req.user.id;
    if (!chat.participants.includes(userId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only session participants can send messages.' });
    }

    const { type, text, media } = req.body;
    if (!text && !media) {
      return res.status(400).json({ error: 'ValidationError', message: 'Message text or media is required.' });
    }

    const user = db.users.get(userId);
    const newMessage = {
      id: uuidv4(),
      requestId: id,
      senderId: userId,
      senderName: user ? user.name : 'Participant',
      type: type || (media ? media.type || 'image' : 'text'),
      text: text || '',
      media: media || null, // { url, type: 'audio'|'image'|'video', durationSec, fileName }
      createdAt: new Date().toISOString(),
      deliveredTo: [userId],
      readBy: [userId]
    };

    const messages = db.messages.get(id) || [];
    messages.push(newMessage);
    db.messages.set(id, messages);

    chat.lastMessage = text || `Shared ${newMessage.type}`;
    chat.lastMessageAt = newMessage.createdAt;
    db.chats.set(id, chat);

    // Notify other participant via Push Notification
    const recipientId = chat.participants.find(p => p !== userId);
    if (recipientId) {
      await notificationService.sendToUser(recipientId, {
        title: `Message from ${user ? user.name : 'Helper/Requester'}`,
        body: text ? (text.length > 50 ? `${text.slice(0, 50)}...` : text) : `Sent an attachment (${newMessage.type})`,
        requestId: id,
        type: 'chat',
        priority: 'normal'
      });
    }

    // Broadcast live via Socket.io
    try {
      emitTo(`request:${id}`, 'chat:message', { requestId: id, message: newMessage });
    } catch (_) {}

    return res.status(201).json({ message: 'Message sent', data: newMessage });
  }

  // Report user from chat
  async reportUser(req, res) {
    const { id } = req.params; // requestId
    const { reportedUserId, reason, comments } = req.body;

    const reportId = `rep_${Date.now()}`;
    const newReport = {
      id: reportId,
      requestId: id,
      reporterId: req.user.id,
      reportedUserId,
      reason: reason || 'Inappropriate behavior',
      comments: comments || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    db.reports.set(reportId, newReport);
    db.logAudit('REPORT_SUBMITTED', req.user.id, { reportId, reportedUserId, reason });

    return res.status(201).json({
      message: 'Report submitted. Our safety moderation team has been notified.',
      reportId
    });
  }
}

module.exports = new ChatController();
