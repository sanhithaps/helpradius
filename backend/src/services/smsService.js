const config = require('../config');
const db = require('../models/dataStore');
const { emitTo } = require('../realtime/io');

class SmsService {
  /**
   * Normalize telephone number to E.164 format (+91XXXXXXXXXX)
   */
  normalizePhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/[^0-9]/g, '');
    if (phone.startsWith('+')) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return `+${digits}`;
  }

  /**
   * Dispatch an emergency SMS alert to a contact.
   */
  async sendEmergencyAlert({ contactName, contactPhone, requesterName, category, location, requestId }) {
    const normalizedPhone = this.normalizePhone(contactPhone);
    const mapsLink = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const message = `HELP RADIUS SOS: ${requesterName} needs help (${(category || 'EMERGENCY').toUpperCase()}) at ${timeString}. Location: ${mapsLink}`;

    const provider = (config.smsProvider || process.env.SMS_PROVIDER || 'simulated').toLowerCase();

    let alertResult = {
      requestId,
      contactName,
      phone: normalizedPhone,
      provider,
      status: 'simulated',
      deliveryBadge: 'Simulated (No real SMS sent)',
      sentAt: new Date().toISOString()
    };

    // 1. Twilio Provider
    if (provider === 'twilio') {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM;

      if (!sid || !token || !from) {
        console.warn('[TWILIO SMS WARNING] Twilio credentials missing in .env. Falling back to simulated provider.');
        alertResult.provider = 'simulated';
        alertResult.status = 'simulated';
        alertResult.deliveryBadge = 'Simulated (Twilio keys missing)';
      } else {
        try {
          const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
          const formData = new URLSearchParams();
          formData.append('To', normalizedPhone);
          formData.append('From', from);
          formData.append('Body', message);

          const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
          });

          const twilioData = await response.json();
          if (response.ok) {
            alertResult.status = 'sent';
            alertResult.providerMessageId = twilioData.sid;
            alertResult.deliveryBadge = 'Cellular SMS Sent ✓';
          } else {
            alertResult.status = 'failed';
            alertResult.error = twilioData.message || 'Twilio dispatch failed';
            alertResult.deliveryBadge = 'SMS Failed (Retry available)';
          }
        } catch (err) {
          alertResult.status = 'failed';
          alertResult.error = err.message;
          alertResult.deliveryBadge = 'SMS Failed';
        }
      }
    } else {
      // 2. Default: Honest Simulated Provider
      console.log(`\n======================================================`);
      console.log(`[SIMULATED SMS GATEWAY - NO CELLULAR CHARGES]`);
      console.log(`To: ${contactName} (${normalizedPhone})`);
      console.log(`Message: ${message}`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log(`Status: SIMULATED (Prototype Mode)`);
      console.log(`======================================================\n`);

      alertResult.status = 'simulated';
      alertResult.deliveryBadge = 'Simulated SMS (Prototype)';
    }

    // 3. In-App Notification check: If contact phone matches a registered user, send live in-app notification!
    const cleanDigits = normalizedPhone.replace(/[^0-9]/g, '');
    for (const u of db.users.values()) {
      const userPhoneDigits = (u.phone || '').replace(/[^0-9]/g, '');
      if (userPhoneDigits && userPhoneDigits === cleanDigits) {
        try {
          const notificationService = require('./notificationService');
          notificationService.sendToUser(u.id, {
            title: `🚨 EMERGENCY ALERT: ${requesterName} needs your help!`,
            body: `You are listed as an emergency contact. Tap to view real-time location.`,
            requestId,
            category,
            type: 'emergency_sos',
            priority: 'urgent'
          });
          alertResult.inAppNotificationSent = true;
          alertResult.inAppRecipientId = u.id;
        } catch (_) {}
        break;
      }
    }

    return alertResult;
  }
}

module.exports = new SmsService();
