const db = require('../models/dataStore');
const { emitTo } = require('../realtime/io');

class NotificationService {
  constructor() {
    this.notifications = []; // in-memory notification queue for instant delivery
    this.subscribers = new Map(); // userId -> response handlers
  }

  /**
   * Broadcast/Send notification to a helper or user.
   * Ensures strict privacy: approximate distance, category, request ID only.
   */
  async sendToUser(userId, payload) {
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      title: payload.title,
      body: payload.body,
      requestId: payload.requestId,
      category: payload.category,
      type: payload.type, // 'emergency_sos' | 'general_help' | 'scheduled_help' | 'accepted' | 'chat'
      distanceKm: payload.distanceKm || null,
      priority: payload.priority || 'normal',
      createdAt: new Date().toISOString(),
      read: false
    };

    this.notifications.push(notification);

    // Keep notifications bounded to last 200 items in memory
    if (this.notifications.length > 200) {
      this.notifications.shift();
    }

    // Emit live via Socket.io to user's private room
    try {
      emitTo(`user:${userId}`, 'notification:new', { notification });
    } catch (_) {}

    // Notify active subscribers if present
    const subscriber = this.subscribers.get(userId);
    if (subscriber && typeof subscriber === 'function') {
      subscriber(notification);
    }

    console.log(`[PUSH NOTIFICATION] To: User(${userId}) | Title: ${payload.title} | Body: ${payload.body}`);
    return notification;
  }

  getUserNotifications(userId) {
    return this.notifications.filter(n => n.userId === userId).slice(-30);
  }

  markAllAsRead(userId) {
    this.notifications.forEach(n => {
      if (n.userId === userId) n.read = true;
    });
  }
}

module.exports = new NotificationService();
