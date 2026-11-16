const db = require('../models/dataStore');
const config = require('../config');
const { toPublicUser } = require('../utils/userUtils');

class AdminController {
  // Overview Dashboard Metrics
  async getMetrics(req, res) {
    const totalUsers = db.users.size;
    let approvedHelpers = 0;
    let pendingHelpers = 0;
    let safetyEligibleCount = 0;

    for (const h of db.helpers.values()) {
      if (h.status === 'approved') approvedHelpers++;
      if (h.status === 'pending') pendingHelpers++;
      if (h.safetyEligible) safetyEligibleCount++;
    }

    let activeEmergency = 0;
    let activeGeneral = 0;
    let activeScheduled = 0;
    let completedRequests = 0;

    for (const r of db.requests.values()) {
      if (r.status === 'searching' || r.status === 'accepted' || r.status === 'in_progress') {
        if (r.type === 'emergency') activeEmergency++;
        else if (r.type === 'general') activeGeneral++;
        else if (r.type === 'scheduled') activeScheduled++;
      } else if (r.status === 'completed') {
        completedRequests++;
      }
    }

    return res.json({
      metrics: {
        totalUsers,
        approvedHelpers,
        pendingHelpers,
        safetyEligibleCount,
        activeRequests: {
          emergency: activeEmergency,
          general: activeGeneral,
          scheduled: activeScheduled,
          total: activeEmergency + activeGeneral + activeScheduled
        },
        completedRequests,
        reportsPending: Array.from(db.reports.values()).filter(r => r.status === 'pending').length
      }
    });
  }

  // Get Helpers for verification review
  async getHelpers(req, res) {
    const { status } = req.query;
    const helpersList = [];

    for (const h of db.helpers.values()) {
      if (!status || h.status === status) {
        helpersList.push(h);
      }
    }

    return res.json({ helpers: helpersList });
  }

  // Approve or Reject Helper Verification
  async updateHelperVerification(req, res) {
    const { helperId } = req.params;
    const { status, safetyEligible, notes } = req.body; // status: 'approved' | 'rejected'

    const helper = db.helpers.get(helperId);
    if (!helper) return res.status(404).json({ error: 'HelperNotFound' });

    if (status) helper.status = status;
    if (typeof safetyEligible === 'boolean') helper.safetyEligible = safetyEligible;

    helper.verification = {
      ...helper.verification,
      reviewedBy: req.user.id,
      reviewedAt: new Date().toISOString(),
      notes: notes || helper.verification?.notes || 'Reviewed by Admin'
    };

    db.helpers.set(helperId, helper);
    db.logAudit('HELPER_VERIFICATION_UPDATED', req.user.id, {
      helperId,
      status: helper.status,
      safetyEligible: helper.safetyEligible
    });

    return res.json({
      message: `Helper status updated to ${helper.status}. Safety Eligible: ${helper.safetyEligible}`,
      helper
    });
  }

  // List Users with pagination & search
  async getUsers(req, res) {
    const { query } = req.query;
    const usersList = [];

    for (const u of db.users.values()) {
      if (query) {
        const q = query.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) continue;
      }
      usersList.push(toPublicUser(u));
    }

    return res.json({ users: usersList });
  }

  // Suspend or Unsuspend User
  async toggleUserSuspension(req, res) {
    const { userId } = req.params;
    const { suspended, reason } = req.body;

    const user = db.users.get(userId);
    if (!user) return res.status(404).json({ error: 'UserNotFound' });

    user.suspended = Boolean(suspended);
    user.suspensionReason = reason || null;
    db.users.set(userId, user);
    db.saveUsers();

    db.logAudit('USER_SUSPENSION_TOGGLED', req.user.id, { userId, suspended: user.suspended });
    return res.json({ message: `User ${user.suspended ? 'suspended' : 'reinstated'}`, user: toPublicUser(user) });
  }

  // Get Reports
  async getReports(req, res) {
    const reports = Array.from(db.reports.values());
    reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ reports });
  }

  // Resolve Report
  async resolveReport(req, res) {
    const { reportId } = req.params;
    const { action, resolutionNotes } = req.body;

    const report = db.reports.get(reportId);
    if (!report) return res.status(404).json({ error: 'ReportNotFound' });

    report.status = 'resolved';
    report.actionTaken = action || 'dismissed';
    report.resolutionNotes = resolutionNotes || '';
    report.resolvedAt = new Date().toISOString();
    report.resolvedBy = req.user.id;

    db.reports.set(reportId, report);
    db.logAudit('REPORT_RESOLVED', req.user.id, { reportId, action: report.actionTaken });

    return res.json({ message: 'Report resolved', report });
  }

  // Get System Configuration
  async getConfig(req, res) {
    return res.json({
      radiusConfig: config.radiusConfig,
      pricingConfig: config.pricingConfig
    });
  }

  // Update System Configuration
  async updateConfig(req, res) {
    const { radiusConfig, pricingConfig } = req.body;

    if (radiusConfig) {
      config.radiusConfig = { ...config.radiusConfig, ...radiusConfig };
    }
    if (pricingConfig) {
      config.pricingConfig = { ...config.pricingConfig, ...pricingConfig };
    }

    db.logAudit('SYSTEM_CONFIG_UPDATED', req.user.id, { updatedBy: req.user.email });
    return res.json({
      message: 'System configuration updated successfully',
      radiusConfig: config.radiusConfig,
      pricingConfig: config.pricingConfig
    });
  }

  // Get Audit Logs
  async getAuditLogs(req, res) {
    return res.json({ logs: db.auditLogs.slice(0, 100) });
  }
}

module.exports = new AdminController();
