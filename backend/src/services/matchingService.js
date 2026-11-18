const db = require('../models/dataStore');
const { calculateHaversineDistance, estimateETA } = require('../utils/distance');

class MatchingService {
  /**
   * Find eligible nearby helpers for a given request within a specific radius in km.
   * @param {Object} request
   * @param {number} radiusKm
   * @returns {Array<Object>} list of matched helpers sorted by distance
   */
  findNearbyEligibleHelpers(request, radiusKm) {
    const { requesterId, location, category, type, requiresVerifiedHelper } = request;
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return [];
    }

    const alreadyNotified = db.notifiedHelperIndex.get(request.id) || new Set();
    const candidates = [];

    for (const [helperId, helper] of db.helpers.entries()) {
      // 1. Must not be the requester themselves
      if (helper.userId === requesterId || helper.id === requesterId) continue;

      // 2. Must be approved and currently available
      if (helper.status !== 'approved' || !helper.isAvailable) continue;

      // 3. If safety check is required (e.g. personal_safety / accident), helper must be safetyEligible
      if (requiresVerifiedHelper && !helper.safetyEligible) continue;

      // 4. Must support the requested category (or general assistance)
      if (helper.categories && helper.categories.length > 0) {
        const matchesCategory = helper.categories.includes(category) || helper.categories.includes('other');
        if (!matchesCategory) continue;
      }

      // 5. Must not have already been notified in an earlier radius step
      if (alreadyNotified.has(helper.id)) continue;

      // 6. Must have valid live device coordinates
      if (!helper.location || typeof helper.location.lat !== 'number' || typeof helper.location.lng !== 'number') continue;

      // 7. Calculate distance
      const distance = calculateHaversineDistance(
        location.lat,
        location.lng,
        helper.location.lat,
        helper.location.lng
      );

      // 8. Check if within current radius
      if (distance <= radiusKm) {
        candidates.push({
          helperId: helper.id,
          name: helper.name,
          avatar: helper.avatar,
          rating: helper.rating,
          reviewsCount: helper.reviewsCount,
          safetyEligible: helper.safetyEligible,
          distanceKm: distance,
          etaMinutes: estimateETA(distance),
          location: helper.location
        });
      }
    }

    // Sort by nearest first
    candidates.sort((a, b) => a.distanceKm - b.distanceKm);
    return candidates;
  }
}

module.exports = new MatchingService();
