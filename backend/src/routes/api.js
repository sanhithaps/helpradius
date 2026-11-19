const express = require('express');
const router = express.Router();

const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');
const authController = require('../controllers/authController');
const helperController = require('../controllers/helperController');
const requestController = require('../controllers/requestController');
const chatController = require('../controllers/chatController');
const callController = require('../controllers/callController');
const adminController = require('../controllers/adminController');
const pricingService = require('../services/pricingService');
const notificationService = require('../services/notificationService');
const upload = require('../middleware/upload');
const db = require('../models/dataStore');

// 1. Health & Status Check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'help-radius-api',
    version: '1.0.0',
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    counts: {
      users: db.users.size,
      helpers: db.helpers.size,
      requests: db.requests.size
    }
  });
});

// 2. Authentication & Emergency Contacts
router.post('/auth/send-otp', (req, res) => authController.sendOtp(req, res));
router.post('/auth/register', (req, res) => authController.register(req, res));
router.post('/auth/login', (req, res) => authController.login(req, res));
router.get('/users/me', requireAuth, (req, res) => authController.getMe(req, res));
router.put('/users/me', requireAuth, (req, res) => authController.updateProfile(req, res));
router.get('/users/me/emergency-contacts', requireAuth, (req, res) => authController.getEmergencyContacts(req, res));
router.post('/users/me/emergency-contacts', requireAuth, (req, res) => authController.addEmergencyContact(req, res));
router.delete('/users/me/emergency-contacts/:contactId', requireAuth, (req, res) => authController.deleteEmergencyContact(req, res));

// 3. Helper Management
router.post('/helpers/apply', requireAuth, (req, res) => helperController.apply(req, res));
router.get('/helpers/me', requireAuth, (req, res) => helperController.getMe(req, res));
router.patch('/helpers/me/availability', requireAuth, (req, res) => helperController.updateAvailability(req, res));
router.put('/helpers/me/location', requireAuth, (req, res) => helperController.updateLocation(req, res));
router.get('/helpers/inbox', requireAuth, (req, res) => helperController.getInboxRequests(req, res));

// 4. Requests (SOS, General, Scheduled)
router.post('/requests', requireAuth, (req, res) => requestController.createRequest(req, res));
router.get('/requests/mine', requireAuth, (req, res) => requestController.getMyRequests(req, res));
router.get('/requests/:id', requireAuth, (req, res) => requestController.getRequestById(req, res));
router.post('/requests/:id/accept', requireAuth, (req, res) => requestController.acceptRequest(req, res));
router.post('/requests/:id/start', requireAuth, (req, res) => requestController.startProgress(req, res));
router.post('/requests/:id/complete', requireAuth, (req, res) => requestController.completeRequest(req, res));
router.patch('/requests/:id/cancel', requireAuth, (req, res) => requestController.cancelRequest(req, res));
router.patch('/requests/:id/reschedule', requireAuth, (req, res) => requestController.rescheduleRequest(req, res));
router.post('/requests/:id/media', requireAuth, upload.single('file'), (req, res) => requestController.addMedia(req, res));
router.post('/requests/:id/rate', requireAuth, (req, res) => requestController.submitRating(req, res));
router.post('/requests/:id/contact-alerts/:alertIndex/retry', requireAuth, (req, res) => requestController.retryContactAlert(req, res));

// 4b. Local Device Media File Upload (Images & Videos)
router.post('/upload', optionalAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ValidationError', message: 'No file provided for upload.' });
  }

  const isVideo = req.file.mimetype.startsWith('video/');
  const fileData = {
    id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: isVideo ? 'video' : 'image',
    url: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedAt: new Date().toISOString()
  };

  return res.status(201).json({
    success: true,
    message: `${isVideo ? 'Video' : 'Image'} uploaded successfully from local device.`,
    file: fileData
  });
});

router.post('/upload/multiple', optionalAuth, upload.array('files', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'ValidationError', message: 'No files provided for upload.' });
  }

  const files = req.files.map((file) => {
    const isVideo = file.mimetype.startsWith('video/');
    return {
      id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: isVideo ? 'video' : 'image',
      url: `/uploads/${file.filename}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString()
    };
  });

  return res.status(201).json({
    success: true,
    message: `${files.length} file(s) uploaded successfully from local device.`,
    files
  });
});

// 5. Live Tracking Session Stream
router.get('/tracking/:id', requireAuth, (req, res) => {
  const session = db.trackingSessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'TrackingNotFound', message: 'No active tracking session found.' });
  }
  return res.json({ session });
});

// 6. Private In-App Chat
router.get('/chats/:id/messages', requireAuth, (req, res) => chatController.getMessages(req, res));
router.post('/chats/:id/messages', requireAuth, (req, res) => chatController.sendMessage(req, res));
router.post('/chats/:id/report', requireAuth, (req, res) => chatController.reportUser(req, res));

// 7. WebRTC In-App Voice Call Signaling
router.get('/calls/:id', requireAuth, (req, res) => callController.getCallSession(req, res));
router.post('/calls/:id/initiate', requireAuth, (req, res) => callController.initiateCall(req, res));
router.post('/calls/:id/answer', requireAuth, (req, res) => callController.answerCall(req, res));
router.post('/calls/:id/candidate', requireAuth, (req, res) => callController.addCandidate(req, res));
router.post('/calls/:id/end', requireAuth, (req, res) => callController.endCall(req, res));

// 8. Notifications
router.get('/notifications', requireAuth, (req, res) => {
  const notifications = notificationService.getUserNotifications(req.user.id);
  return res.json({ notifications });
});
router.post('/notifications/mark-read', requireAuth, (req, res) => {
  notificationService.markAllAsRead(req.user.id);
  return res.json({ success: true });
});

// 9. Pricing Estimate Calculator
router.get('/pricing/estimate', (req, res) => {
  const { type, distanceKm, radiusStepIndex, voluntaryReward, durationMinutes, category } = req.query;
  const breakdown = pricingService.calculateBreakdown({
    type,
    distanceKm: parseFloat(distanceKm || '1.0'),
    radiusStepIndex: parseInt(radiusStepIndex || '0', 10),
    voluntaryReward: parseFloat(voluntaryReward || '0'),
    durationMinutes: parseInt(durationMinutes || '30', 10),
    category
  });
  return res.json({ breakdown });
});

// 10. Seed Helpers Relocation Helper (allows demo tester to place nearby helpers at their current GPS coordinates)
router.post('/seed/relocate', (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Valid lat & lng numbers required.' });
  }
  db.relocateSeedHelpersAround(lat, lng);
  return res.json({
    message: `Relocated seed helpers around coordinates [${lat}, ${lng}].`,
    helpers: Array.from(db.helpers.values()).map(h => ({
      id: h.id,
      name: h.name,
      location: h.location,
      safetyEligible: h.safetyEligible
    }))
  });
});

// 11. Admin Dashboard APIs (Admin Role Protected)
router.get('/admin/metrics', requireAuth, requireAdmin, (req, res) => adminController.getMetrics(req, res));
router.get('/admin/helpers', requireAuth, requireAdmin, (req, res) => adminController.getHelpers(req, res));
router.patch('/admin/helpers/:helperId', requireAuth, requireAdmin, (req, res) => adminController.updateHelperVerification(req, res));
router.get('/admin/users', requireAuth, requireAdmin, (req, res) => adminController.getUsers(req, res));
router.patch('/admin/users/:userId/suspend', requireAuth, requireAdmin, (req, res) => adminController.toggleUserSuspension(req, res));
router.get('/admin/reports', requireAuth, requireAdmin, (req, res) => adminController.getReports(req, res));
router.patch('/admin/reports/:reportId/resolve', requireAuth, requireAdmin, (req, res) => adminController.resolveReport(req, res));
router.get('/admin/config', requireAuth, requireAdmin, (req, res) => adminController.getConfig(req, res));
router.put('/admin/config', requireAuth, requireAdmin, (req, res) => adminController.updateConfig(req, res));
router.get('/admin/audit-logs', requireAuth, requireAdmin, (req, res) => adminController.getAuditLogs(req, res));

// 12. Live Network / Device IP Geolocation Fallback
// Provides real live location for devices without GPS chips or when browser blocks HTML5 geolocation on insecure HTTP origins
router.get('/location/detect', async (req, res) => {
  try {
    const https = require('https');
    const forwarded = req.headers['x-forwarded-for'];
    const remote = req.socket?.remoteAddress;
    const clientIp = (forwarded ? String(forwarded).split(',')[0].trim() : (remote || '')).replace('::ffff:', '');
    
    // Check if client IP is public or private
    const isPrivate = !clientIp || clientIp.startsWith('10.') || clientIp.startsWith('192.168.') || clientIp.startsWith('127.') || clientIp === '::1';
    const targetUrl = isPrivate ? 'https://ipwho.is/' : `https://ipwho.is/${clientIp}`;

    const apiReq = https.get(targetUrl, { timeout: 4000 }, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
            const cityName = parsed.city || parsed.region || 'Current Location';
            const regionName = parsed.region || '';
            const addr = [cityName, regionName, parsed.country].filter(Boolean).join(', ');
            return res.json({
              success: true,
              lat: parsed.latitude,
              lng: parsed.longitude,
              accuracy: 2500,
              city: cityName,
              region: regionName,
              address: addr || 'Live Network Location',
              source: 'network_ip',
              ip: parsed.ip || clientIp
            });
          }
        } catch (e) {}

        return res.json({
          success: true,
          lat: 12.9716,
          lng: 77.5946,
          accuracy: 5000,
          city: 'Bengaluru',
          address: 'Bengaluru, Karnataka (Network Location)',
          source: 'network_fallback'
        });
      });
    });

    apiReq.on('error', () => {
      return res.json({
        success: true,
        lat: 12.9716,
        lng: 77.5946,
        accuracy: 5000,
        city: 'Bengaluru',
        address: 'Bengaluru, Karnataka (Network Location)',
        source: 'network_fallback'
      });
    });

    apiReq.on('timeout', () => {
      apiReq.destroy();
      return res.json({
        success: true,
        lat: 12.9716,
        lng: 77.5946,
        accuracy: 5000,
        city: 'Bengaluru',
        address: 'Bengaluru, Karnataka (Network Location)',
        source: 'network_fallback'
      });
    });
  } catch (err) {
    return res.json({
      success: true,
      lat: 12.9716,
      lng: 77.5946,
      accuracy: 5000,
      city: 'Bengaluru',
      address: 'Bengaluru, Karnataka (Network Location)',
      source: 'network_fallback'
    });
  }
});

module.exports = router;
