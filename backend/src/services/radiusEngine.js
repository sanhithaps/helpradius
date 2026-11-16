const db = require('../models/dataStore');
const config = require('../config');
const matchingService = require('./matchingService');
const notificationService = require('./notificationService');
const { emitTo } = require('../realtime/io');

class RadiusEngine {
  constructor() {
    this.workerInterval = null;
    this.isProcessing = false;
  }

  start() {
    if (this.workerInterval) return;
    console.log('[RADIUS ENGINE] Background worker initialized. Checking active requests.');
    this.workerInterval = setInterval(() => {
      this.evaluateActiveRequests();
    }, 3000);
  }

  stop() {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
  }

  /**
   * Helper to retrieve radius configuration with DEMO_FAST_RADIUS override support
   */
  getRadiusConfig(type) {
    const base = config.radiusConfig[type] || config.radiusConfig.general;
    if (process.env.DEMO_FAST_RADIUS === 'true') {
      return {
        ...base,
        waitSec: [15, 20, 30, 45]
      };
    }
    return base;
  }

  /**
   * Initialize expansion on a brand new request.
   */
  async initializeRequestExpansion(request) {
    const categoryConfig = this.getRadiusConfig(request.type);
    const initialRadiusKm = categoryConfig.stepsKm[0];
    const initialWaitSec = categoryConfig.waitSec[0];

    request.radius = {
      currentKm: initialRadiusKm,
      stepIndex: 0,
      totalSteps: categoryConfig.stepsKm.length,
      history: [
        {
          radiusKm: initialRadiusKm,
          step: 1,
          startedAt: new Date().toISOString(),
          helpersFound: 0
        }
      ]
    };
    request.nextCheckAt = Date.now() + initialWaitSec * 1000;

    // Search and notify for initial radius step (Step 0)
    await this.expandAndNotify(request);

    // Live Socket broadcast
    try {
      emitTo(`request:${request.id}`, 'request:updated', { request });
      emitTo(`user:${request.requesterId}`, 'request:updated', { request });
    } catch (_) {}
  }

  /**
   * Periodic evaluation worker
   */
  async evaluateActiveRequests() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = Date.now();
      for (const [requestId, request] of db.requests.entries()) {
        if (request.status !== 'searching' && request.status !== 'scheduled') continue;

        if (request.nextCheckAt && now >= request.nextCheckAt) {
          const categoryConfig = this.getRadiusConfig(request.type);
          const currentStep = request.radius?.stepIndex || 0;

          if (currentStep + 1 < categoryConfig.stepsKm.length) {
            request.radius.stepIndex = currentStep + 1;
            request.radius.currentKm = categoryConfig.stepsKm[request.radius.stepIndex];
            const waitSec = categoryConfig.waitSec[request.radius.stepIndex] || 45;
            request.nextCheckAt = now + waitSec * 1000;

            request.radius.history.push({
              radiusKm: request.radius.currentKm,
              step: request.radius.stepIndex + 1,
              startedAt: new Date().toISOString(),
              helpersFound: 0
            });

            console.log(`[RADIUS ENGINE] Request ${requestId} expanded to ${request.radius.currentKm} km (Step ${request.radius.stepIndex + 1}/${categoryConfig.stepsKm.length})`);
            await this.expandAndNotify(request);

            // Broadcast expansion update via socket
            try {
              emitTo(`request:${requestId}`, 'request:updated', { request });
              emitTo(`user:${request.requesterId}`, 'request:updated', { request });
            } catch (_) {}
          } else {
            // Reached max radius and timed out
            request.status = 'expired';
            request.expiredAt = new Date().toISOString();
            console.log(`[RADIUS ENGINE] Request ${requestId} expired without helper acceptance.`);

            try {
              emitTo(`request:${requestId}`, 'request:updated', { request });
              emitTo(`user:${request.requesterId}`, 'request:updated', { request });
            } catch (_) {}

            await notificationService.sendToUser(request.requesterId, {
              title: 'Search Radius Expired',
              body: 'No nearby helpers accepted your request yet. You may retry or contact emergency services directly.',
              requestId: request.id,
              type: 'expired',
              priority: 'high'
            });

            db.requests.set(requestId, request);
            db.saveRequests();
          }
        }
      }
    } catch (err) {
      console.error('[RADIUS ENGINE ERROR]', err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Search within current radius and notify new helpers only
   */
  async expandAndNotify(request) {
    const candidates = matchingService.findNearbyEligibleHelpers(request, request.radius.currentKm);
    
    if (!db.notifiedHelperIndex.has(request.id)) {
      db.notifiedHelperIndex.set(request.id, new Set());
    }
    const notifiedSet = db.notifiedHelperIndex.get(request.id);

    const currentHistory = request.radius.history[request.radius.history.length - 1];
    if (currentHistory) {
      currentHistory.helpersFound += candidates.length;
    }

    for (const helper of candidates) {
      notifiedSet.add(helper.helperId);

      const isEmergency = request.type === 'emergency';
      const notificationTitle = isEmergency 
        ? `EMERGENCY ALERT: ${request.category.toUpperCase().replace('_', ' ')}` 
        : `New Help Request Nearby (${request.category})`;

      const notificationBody = `${helper.distanceKm} km away. Priority: ${request.priority.toUpperCase()}`;

      await notificationService.sendToUser(helper.helperId, {
        title: notificationTitle,
        body: notificationBody,
        requestId: request.id,
        category: request.category,
        distanceKm: helper.distanceKm,
        type: request.type,
        priority: isEmergency ? 'high' : 'normal'
      });
    }

    db.requests.set(request.id, request);
  }
}

module.exports = new RadiusEngine();
