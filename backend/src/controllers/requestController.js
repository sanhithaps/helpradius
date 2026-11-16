const { v4: uuidv4 } = require('uuid');
const db = require('../models/dataStore');
const radiusEngine = require('../services/radiusEngine');
const smsService = require('../services/smsService');
const notificationService = require('../services/notificationService');
const pricingService = require('../services/pricingService');
const { calculateHaversineDistance, estimateETA } = require('../utils/distance');
const { emitTo } = require('../realtime/io');

class RequestController {
  // Create Request (Emergency SOS, General, Scheduled)
  async createRequest(req, res) {
    const requesterId = req.user.id;
    const user = db.users.get(requesterId);
    if (!user) return res.status(404).json({ error: 'UserNotFound' });

    const {
      type, // 'emergency' | 'general' | 'scheduled'
      category,
      description,
      location,
      media,
      voluntaryReward,
      scheduledFor,
      expectedDurationMin,
      meetingLocation
    } = req.body;

    if (!type || !category || !location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Request type, category, and valid coordinates are required.'
      });
    }

    // Personal safety or physical danger emergency mandates safety-eligible verified helpers
    const requiresVerifiedHelper = type === 'emergency' && 
      (category === 'personal_safety' || category === 'physical_danger');

    // Priority
    const priority = type === 'emergency' ? 'urgent' : (type === 'general' ? 'high' : 'normal');

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Automatically relocate seed helpers dynamically around requester coords if present
    if (typeof db.relocateSeedHelpersAround === 'function') {
      db.relocateSeedHelpersAround(location.lat, location.lng);
    }

    const newRequest = {
      id: requestId,
      type,
      category,
      priority,
      status: type === 'scheduled' ? 'scheduled' : 'searching',
      requesterId,
      requesterName: user.name,
      requesterAvatar: user.avatar,
      description: description || (type === 'emergency' ? `SOS: ${category.toUpperCase()}` : 'Assistance requested'),
      location: {
        lat: location.lat,
        lng: location.lng,
        accuracyMeters: location.accuracyMeters || 15,
        address: location.address || 'User GPS Coordinate'
      },
      media: Array.isArray(media) ? media : [],
      requiresVerifiedHelper,
      voluntaryReward: Number(voluntaryReward) || 0,
      scheduledFor: scheduledFor || null,
      expectedDurationMin: Number(expectedDurationMin) || 60,
      meetingLocation: meetingLocation || null,
      acceptedHelperId: null,
      acceptedAt: null,
      completedAt: null,
      cancelledAt: null,
      rating: null,
      createdAt: new Date().toISOString()
    };

    db.requests.set(requestId, newRequest);
    db.saveRequests();

    // 1. If Emergency SOS: alert all saved emergency contacts in parallel regardless of distance!
    const contactAlertList = [];
    if (type === 'emergency' && user.emergencyContacts && user.emergencyContacts.length > 0) {
      for (const contact of user.emergencyContacts) {
        // Send alert asynchronously via SmsService
        const alertResult = await smsService.sendEmergencyAlert({
          contactName: contact.name,
          contactPhone: contact.phone,
          requesterName: user.name,
          category,
          location: newRequest.location,
          requestId
        });

        contactAlertList.push({
          contactId: contact.id,
          name: contact.name,
          phone: contact.phone,
          relationship: contact.relationship,
          channel: 'sms',
          status: alertResult.status,
          deliveryBadge: alertResult.deliveryBadge,
          timestamp: alertResult.sentAt
        });
      }
    }
    db.contactAlerts.set(requestId, contactAlertList);

    // 2. Start radius search & notification engine
    await radiusEngine.initializeRequestExpansion(newRequest);

    // Live Socket dispatch
    try {
      emitTo('helpers:available', 'request:new', { request: newRequest });
      emitTo(`request:${newRequest.id}`, 'request:updated', { request: newRequest });
    } catch (_) {}

    db.logAudit('REQUEST_CREATED', requesterId, {
      requestId,
      type,
      category,
      priority,
      requiresVerifiedHelper
    });

    return res.status(201).json({
      message: `${type.toUpperCase()} request initiated successfully.`,
      request: newRequest,
      contactAlerts: contactAlertList,
      pricingEstimate: pricingService.calculateBreakdown({
        type,
        distanceKm: 1.5,
        voluntaryReward: newRequest.voluntaryReward,
        durationMinutes: newRequest.expectedDurationMin,
        category
      })
    });
  }

  // Get current user requests
  async getMyRequests(req, res) {
    const userId = req.user.id;
    const { status, type } = req.query;

    const results = [];
    for (const reqItem of db.requests.values()) {
      if (reqItem.requesterId === userId || reqItem.acceptedHelperId === userId) {
        if (status && reqItem.status !== status) continue;
        if (type && reqItem.type !== type) continue;

        // Enrich with helper details if accepted
        let helperInfo = null;
        if (reqItem.acceptedHelperId) {
          const helper = db.helpers.get(reqItem.acceptedHelperId);
          if (helper) {
            helperInfo = {
              id: helper.id,
              name: helper.name,
              avatar: helper.avatar,
              rating: helper.rating,
              safetyEligible: helper.safetyEligible
            };
          }
        }

        results.push({
          ...reqItem,
          helper: helperInfo,
          contactAlerts: db.contactAlerts.get(reqItem.id) || []
        });
      }
    }

    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ requests: results });
  }

  // Get single request details
  async getRequestById(req, res) {
    const { id } = req.params;
    const request = db.requests.get(id);

    if (!request) {
      return res.status(404).json({ error: 'NotFound', message: 'Request not found.' });
    }

    const userId = req.user.id;
    const isRequester = request.requesterId === userId;
    const isAcceptedHelper = request.acceptedHelperId === userId;
    const isAdmin = req.user.role === 'admin';
    const isSearchingNearby = request.status === 'searching' && req.user.isHelper;

    if (!isRequester && !isAcceptedHelper && !isAdmin && !isSearchingNearby) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to view this request.'
      });
    }

    let helperInfo = null;
    if (request.acceptedHelperId) {
      const helper = db.helpers.get(request.acceptedHelperId);
      if (helper) {
        helperInfo = {
          id: helper.id,
          name: helper.name,
          avatar: helper.avatar,
          rating: helper.rating,
          safetyEligible: helper.safetyEligible
        };
      }
    }

    const contactAlerts = db.contactAlerts.get(id) || [];
    const trackingSession = db.trackingSessions.get(id) || null;

    return res.json({
      request,
      helper: helperInfo,
      contactAlerts,
      trackingSession
    });
  }

  // Helper accepts request (Atomic concurrency check: first acceptor wins)
  async acceptRequest(req, res) {
    const helperId = req.user.id;
    const { id } = req.params;
    const request = db.requests.get(id);

    if (!request) return res.status(404).json({ error: 'NotFound' });

    // Atomic race-condition check
    if (request.status !== 'searching' && request.status !== 'scheduled') {
      if (request.status === 'cancelled') {
        return res.status(410).json({
          error: 'RequestCancelled',
          message: 'This request was cancelled by the requester and is no longer available.'
        });
      }
      return res.status(409).json({
        error: 'AlreadyAccepted',
        message: 'This request has already been accepted by another helper.'
      });
    }

    const helper = db.helpers.get(helperId);
    if (!helper || helper.status !== 'approved') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only approved helpers can accept requests.'
      });
    }

    // Safety verification check
    if (request.requiresVerifiedHelper && !helper.safetyEligible) {
      return res.status(403).json({
        error: 'SafetyRequirementNotMet',
        message: 'This personal safety request requires an approved, safety-certified helper.'
      });
    }

    // Update request state
    request.status = 'accepted';
    request.acceptedHelperId = helperId;
    request.acceptedAt = new Date().toISOString();
    db.requests.set(id, request);
    db.saveRequests();
    db.saveRequests();

    // Create Tracking Session
    const distanceKm = calculateHaversineDistance(
      request.location.lat,
      request.location.lng,
      helper.location.lat,
      helper.location.lng
    );

    const trackingSession = {
      requestId: id,
      requesterId: request.requesterId,
      helperId: helper.id,
      helperName: helper.name,
      helperAvatar: helper.avatar,
      active: true,
      startedAt: new Date().toISOString(),
      distanceKm,
      etaMinutes: estimateETA(distanceKm),
      requesterLocation: request.location,
      helperLocation: helper.location
    };
    db.trackingSessions.set(id, trackingSession);

    // Create Private Chat Room (Phase 5)
    if (!db.chats.has(id)) {
      db.chats.set(id, {
        id,
        requestId: id,
        participants: [request.requesterId, helper.id],
        active: true,
        createdAt: new Date().toISOString(),
        lastMessage: 'Helper accepted the request.',
        lastMessageAt: new Date().toISOString()
      });
      db.messages.set(id, [
        {
          id: `msg_sys_1`,
          senderId: 'system',
          senderName: 'System',
          type: 'system',
          text: `🤝 ${helper.name} has accepted your request and is on their way!`,
          createdAt: new Date().toISOString()
        }
      ]);
    }

    // Notify Requester immediately
    await notificationService.sendToUser(request.requesterId, {
      title: 'Helper Accepted Your Request!',
      body: `${helper.name} accepted your ${request.category} request. Live tracking & chat now active.`,
      requestId: id,
      type: 'accepted',
      priority: 'high'
    });

    // Real-time Socket broadcasts
    try {
      emitTo(`request:${id}`, 'request:updated', { request, helper, trackingSession });
      emitTo(`user:${request.requesterId}`, 'request:updated', { request, helper, trackingSession });
      emitTo('helpers:available', 'request:taken', { requestId: id, helperId });
    } catch (_) {}

    db.logAudit('REQUEST_ACCEPTED', helperId, { requestId: id, helperId });

    return res.json({
      message: 'Request accepted successfully. Live tracking and chat activated.',
      request,
      trackingSession
    });
  }

  // Start progress (en route)
  async startProgress(req, res) {
    const { id } = req.params;
    const request = db.requests.get(id);
    if (!request) return res.status(404).json({ error: 'NotFound' });

    request.status = 'in_progress';
    db.requests.set(id, request);
    db.saveRequests();
    db.saveRequests();

    return res.json({ message: 'Request status set to in_progress', request });
  }

  // Complete Request
  async completeRequest(req, res) {
    const { id } = req.params;
    const request = db.requests.get(id);
    if (!request) return res.status(404).json({ error: 'NotFound' });

    request.status = 'completed';
    request.completedAt = new Date().toISOString();

    // Terminate tracking session and lock chat
    const session = db.trackingSessions.get(id);
    if (session) {
      session.active = false;
      db.trackingSessions.set(id, session);
    }

    const chat = db.chats.get(id);
    if (chat) {
      chat.active = false; // Chat becomes read-only
      db.chats.set(id, chat);
    }

    // Calculate final transparent pricing breakdown
    const helper = db.helpers.get(request.acceptedHelperId);
    let finalDistance = 1.5;
    if (helper) {
      finalDistance = calculateHaversineDistance(
        request.location.lat,
        request.location.lng,
        helper.location.lat,
        helper.location.lng
      );
    }

    const pricing = pricingService.calculateBreakdown({
      type: request.type,
      distanceKm: finalDistance,
      radiusStepIndex: request.radius ? request.radius.stepIndex : 0,
      voluntaryReward: request.voluntaryReward,
      durationMinutes: request.expectedDurationMin,
      category: request.category
    });

    request.finalPricing = pricing;
    db.requests.set(id, request);
    db.saveRequests();
    db.saveRequests();

    db.logAudit('REQUEST_COMPLETED', req.user.id, { requestId: id, pricing });

    try {
      emitTo(`request:${id}`, 'request:updated', { request, status: 'completed' });
      emitTo(`user:${request.requesterId}`, 'request:updated', { request, status: 'completed' });
      if (request.acceptedHelperId) {
        emitTo(`user:${request.acceptedHelperId}`, 'request:updated', { request, status: 'completed' });
      }
    } catch (_) {}

    return res.json({
      message: 'Request marked as completed. Thank you for making the community safer!',
      request,
      finalPricing: pricing
    });
  }

  // Cancel Request
  async cancelRequest(req, res) {
    const { id } = req.params;
    const { reason } = req.body || {};
    const request = db.requests.get(id);
    if (!request) return res.status(404).json({ error: 'NotFound', message: 'Request not found' });

    if (request.status === 'completed') {
      return res.status(400).json({ error: 'AlreadyCompleted', message: 'Completed requests cannot be cancelled.' });
    }

    request.status = 'cancelled';
    request.cancelledAt = new Date().toISOString();
    request.cancellationReason = reason || 'Cancelled by user';

    // Stop tracking session and lock chat
    const session = db.trackingSessions.get(id);
    if (session) {
      session.active = false;
      db.trackingSessions.set(id, session);
    }

    const chat = db.chats.get(id);
    if (chat) {
      chat.active = false;
      db.chats.set(id, chat);
    }

    db.requests.set(id, request);
    db.saveRequests();
    db.logAudit('REQUEST_CANCELLED', req.user.id, { requestId: id, reason: request.cancellationReason });

    // If helper was accepted, notify them
    if (request.acceptedHelperId) {
      await notificationService.sendToUser(request.acceptedHelperId, {
        title: 'Request Cancelled',
        body: `The assistance request has been cancelled (${request.cancellationReason}).`,
        requestId: id,
        type: 'cancelled',
        priority: 'high'
      });
    }

    try {
      emitTo(`request:${id}`, 'request:updated', { request, status: 'cancelled' });
      emitTo(`user:${request.requesterId}`, 'request:updated', { request, status: 'cancelled' });
      emitTo('helpers:available', 'request:taken', { requestId: id, cancelled: true });
    } catch (_) {}

    return res.json({ message: 'Request cancelled successfully', request });
  }

  // Reschedule (Scheduled help only)
  async rescheduleRequest(req, res) {
    const { id } = req.params;
    const { scheduledFor, meetingLocation } = req.body;
    const request = db.requests.get(id);

    if (!request) return res.status(404).json({ error: 'NotFound' });
    if (request.type !== 'scheduled') {
      return res.status(400).json({ error: 'InvalidOperation', message: 'Only scheduled help requests can be rescheduled.' });
    }

    request.scheduledFor = scheduledFor;
    if (meetingLocation) request.meetingLocation = meetingLocation;
    request.status = 'scheduled';
    request.acceptedHelperId = null; // reset acceptance for new date

    db.requests.set(id, request);
    db.saveRequests();
    return res.json({ message: 'Request rescheduled successfully', request });
  }

  // Attach media to request
  async addMedia(req, res) {
    const { id } = req.params;
    const { type, url, fileName } = req.body;
    const request = db.requests.get(id);
    if (!request) return res.status(404).json({ error: 'NotFound' });

    request.media = request.media || [];
    const mediaItem = {
      id: uuidv4(),
      type: type || 'image',
      url: url || 'https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?w=600',
      fileName: fileName || 'attachment',
      uploadedAt: new Date().toISOString()
    };

    request.media.push(mediaItem);
    db.requests.set(id, request);
    db.saveRequests();

    return res.status(201).json({ message: 'Media attached', media: mediaItem });
  }

  // Rate assistance (1-5 stars + comment + I'm safe verification)
  async submitRating(req, res) {
    const { id } = req.params;
    const { rating, comment, isSafeConfirmed } = req.body;
    const request = db.requests.get(id);
    if (!request) return res.status(404).json({ error: 'NotFound' });

    request.rating = {
      stars: Number(rating) || 5,
      comment: comment || '',
      isSafeConfirmed: Boolean(isSafeConfirmed),
      ratedAt: new Date().toISOString()
    };

    // Update helper review average
    if (request.acceptedHelperId) {
      const helper = db.helpers.get(request.acceptedHelperId);
      if (helper) {
        helper.reviewsCount = (helper.reviewsCount || 0) + 1;
        helper.rating = Math.round(((helper.rating * (helper.reviewsCount - 1) + Number(rating)) / helper.reviewsCount) * 10) / 10;
        db.helpers.set(helper.id, helper);
      }
    }

    db.requests.set(id, request);
    db.saveRequests();
    return res.json({ message: 'Rating recorded. Thank you for your feedback!', request });
  }
}

module.exports = new RequestController();
