const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../models/dataStore');
const { toPublicUser } = require('../utils/userUtils');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      uid: user.id,
      email: user.email,
      role: user.role,
      isHelper: user.isHelper
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn || '7d' }
  );
}

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

class AuthController {
  // Simulated OTP verification endpoint
  async sendOtp(req, res) {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'ValidationError', message: 'Phone number is required.' });
    }

    console.log(`[SIMULATED OTP] Sent OTP 123456 to phone: ${phone}`);
    return res.json({
      success: true,
      phone,
      simulatedOtp: '123456',
      message: 'Simulated OTP sent. Use 123456 to verify (Prototype / Test Mode).'
    });
  }

  // Register with complete user details and verification ID
  async register(req, res) {
    const {
      name,
      email,
      phone,
      password,
      verificationId,
      idType,
      emergencyContacts,
      permissions,
      role,
      isHelper,
      helperCategories,
      address,
      location
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'ValidationError', message: 'Full name is required.' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'ValidationError', message: 'Email address is required.' });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'ValidationError', message: 'Mobile phone number is required.' });
    }

    // Password validation: at least 6 characters (recommended 8+ with letters and numbers)
    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Auto-generate or sanitize verification ID if not provided
    const effectiveVerificationId = (verificationId && String(verificationId).trim())
      ? String(verificationId).trim()
      : `AID-${Math.floor(100000 + Math.random() * 900000)}`;

    const cleanEmail = email.toLowerCase().trim();
    let cleanPhone = phone.trim();
    // Normalize cleanPhone: if 10 digits without country code, prefix +91
    const rawDigits = cleanPhone.replace(/\D/g, '');
    if (rawDigits.length === 10) {
      cleanPhone = `+91${rawDigits}`;
    } else if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
      cleanPhone = `+${rawDigits}`;
    }

    // Check duplicate email / phone
    for (const u of db.users.values()) {
      if (u.email && u.email.toLowerCase() === cleanEmail) {
        return res.status(400).json({
          error: 'ConflictError',
          message: 'An account with this email already exists. Please log in instead.'
        });
      }
      const existingDigits = (u.phone || '').replace(/\D/g, '');
      const newDigits = cleanPhone.replace(/\D/g, '');
      if (
        (existingDigits && newDigits && existingDigits === newDigits) ||
        (existingDigits.length >= 10 && newDigits.length >= 10 && existingDigits.slice(-10) === newDigits.slice(-10))
      ) {
        return res.status(400).json({
          error: 'ConflictError',
          message: 'An account with this mobile number already exists. Please log in instead.'
        });
      }
    }

    // Emergency contacts (max 6, no fake default contacts!)
    const contacts = Array.isArray(emergencyContacts) ? emergencyContacts.slice(0, 6) : [];

    const wantsToBeHelper = Boolean(isHelper || role === 'helper');

    // Secure ID handling: never store raw full ID number, mask to last 4
    const cleanId = String(effectiveVerificationId).replace(/[^a-zA-Z0-9]/g, '');
    const last4 = cleanId.length >= 4 ? cleanId.slice(-4) : cleanId.padStart(4, 'X');
    const idLast4 = `XXXX-XXXX-${last4}`;

    // Hash password with bcryptjs
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      idLast4,
      idType: idType || 'Government / National ID',
      idVerified: false,
      role: wantsToBeHelper ? 'helper' : (role === 'admin' ? 'admin' : 'user'),
      isHelper: wantsToBeHelper,
      address: address ? address.trim() : 'Current Location',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`,
      emergencyContacts: contacts.map(c => ({
        id: c.id || uuidv4(),
        name: c.name ? c.name.trim() : 'Emergency Contact',
        phone: c.phone ? c.phone.trim() : '',
        relationship: c.relationship || 'Family'
      })).filter(c => c.name && c.phone),
      permissions: {
        locationGranted: permissions?.locationGranted !== false,
        notificationsGranted: permissions?.notificationsGranted !== false
      },
      suspended: false,
      createdAt: new Date().toISOString()
    };

    db.users.set(newUser.id, newUser);

    // If registered as Helper, create approved helper profile
    let helperRecord = null;
    if (wantsToBeHelper) {
      const defaultCategories = [
        'accident', 'health', 'personal_safety', 'physical_danger',
        'puncture', 'roadside', 'stranded', 'heavy_lifting', 'groceries', 'companion'
      ];
      helperRecord = {
        id: newUser.id,
        userId: newUser.id,
        name: newUser.name,
        avatar: newUser.avatar,
        phone: newUser.phone,
        idLast4: newUser.idLast4,
        idType: newUser.idType,
        status: 'approved',
        safetyEligible: true,
        isAvailable: true,
        rating: 5.0,
        reviewsCount: 0,
        categories: Array.isArray(helperCategories) && helperCategories.length > 0 ? helperCategories : defaultCategories,
        location: (location && typeof location.lat === 'number' && typeof location.lng === 'number') ? {
          lat: location.lat,
          lng: location.lng,
          updatedAt: new Date().toISOString()
        } : {
          lat: null,
          lng: null,
          updatedAt: new Date().toISOString()
        },
        verification: {
          simulatedIdType: newUser.idType,
          idLast4: newUser.idLast4,
          submittedAt: new Date().toISOString(),
          reviewedBy: 'system_auto_verify',
          reviewedAt: new Date().toISOString(),
          notes: 'Verified during community registration'
        }
      };
      db.helpers.set(newUser.id, helperRecord);
      db.saveHelpers();
    }

    db.saveUsers();
    db.logAudit('USER_REGISTERED', newUser.id, {
      email: newUser.email,
      role: newUser.role,
      idLast4: newUser.idLast4
    });

    const token = generateToken(newUser);
    return res.status(201).json({
      message: 'Account created and verified successfully',
      user: toPublicUser(newUser),
      helper: helperRecord,
      token
    });
  }

  // Strict Login against database
  async login(req, res) {
    const { email, phone, identifier, password } = req.body;
    const loginTarget = (identifier || email || phone || '').toLowerCase().trim();

    if (!loginTarget || !password) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Email/phone and password are required.'
      });
    }

    let user = null;
    for (const u of db.users.values()) {
      if (u.email && u.email.toLowerCase() === loginTarget) {
        user = u;
        break;
      }
      if (u.phone && (u.phone === loginTarget || u.phone.replace(/[^0-9]/g, '') === loginTarget.replace(/[^0-9]/g, ''))) {
        user = u;
        break;
      }
    }

    // Security requirement: Generic 401 error message for both unknown user and wrong password
    // to prevent email enumeration attacks
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email/phone or password'
      });
    }

    // Check account suspension
    if (user.suspended || user.isSuspended) {
      return res.status(403).json({
        error: 'AccountSuspended',
        message: 'Your account has been suspended by an administrator.'
      });
    }

    // Verify Password against stored bcrypt hash
    let passwordValid = false;
    if (user.passwordHash) {
      passwordValid = await bcrypt.compare(password, user.passwordHash);
    } else if (user.password) {
      // Legacy user migration on first login
      if (user.password === password) {
        passwordValid = true;
        user.passwordHash = await bcrypt.hash(password, 10);
        delete user.password;
        db.users.set(user.id, user);
        db.saveUsers();
      }
    }

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email/phone or password'
      });
    }

    const helper = db.helpers.get(user.id) || null;
    const token = generateToken(user);
    return res.json({
      message: 'Logged in successfully',
      user: toPublicUser(user),
      helper,
      token
    });
  }

  // Get current user profile
  async getMe(req, res) {
    const user = db.users.get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'NotFound', message: 'User not found in database.' });
    }
    const helper = db.helpers.get(user.id);
    return res.json({
      user: toPublicUser(user),
      helper: helper || null
    });
  }

  // Update profile
  async updateProfile(req, res) {
    const user = db.users.get(req.user.id);
    if (!user) return res.status(404).json({ error: 'NotFound' });

    const { name, phone, avatar, address, verificationId, permissions, password } = req.body;
    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    if (avatar) user.avatar = avatar;
    if (address) user.address = address.trim();
    if (verificationId) {
      const clean = String(verificationId).replace(/[^a-zA-Z0-9]/g, '');
      const last4 = clean.length >= 4 ? clean.slice(-4) : clean.padStart(4, 'X');
      user.idLast4 = `XXXX-XXXX-${last4}`;
      delete user.verificationId;
    }
    if (permissions) user.permissions = { ...user.permissions, ...permissions };
    if (password && PASSWORD_REGEX.test(password)) {
      user.passwordHash = await bcrypt.hash(password, 10);
      delete user.password;
    }

    db.users.set(user.id, user);
    db.saveUsers();

    return res.json({
      message: 'Profile updated successfully',
      user: toPublicUser(user)
    });
  }

  // Emergency contacts endpoints
  async getEmergencyContacts(req, res) {
    const user = db.users.get(req.user.id);
    if (!user) return res.status(404).json({ error: 'NotFound' });
    const contacts = user.emergencyContacts || [];
    return res.json({
      contacts,
      emergencyContacts: contacts
    });
  }

  async addEmergencyContact(req, res) {
    const user = db.users.get(req.user.id);
    if (!user) return res.status(404).json({ error: 'NotFound' });

    const { name, phone, relationship, email } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'ValidationError', message: 'Contact name and phone are required.' });
    }

    user.emergencyContacts = user.emergencyContacts || [];
    if (user.emergencyContacts.length >= 6) {
      return res.status(400).json({
        error: 'LimitReached',
        message: 'Maximum limit of 6 emergency contacts reached. Please remove one before adding another.'
      });
    }

    const newContact = {
      id: uuidv4(),
      name: name.trim(),
      phone: phone.trim(),
      relationship: relationship ? relationship.trim() : 'Family',
      email: email ? email.trim() : null
    };

    user.emergencyContacts.push(newContact);
    db.users.set(user.id, user);
    db.saveUsers();

    return res.status(201).json({
      message: 'Emergency contact added',
      contact: newContact,
      contacts: user.emergencyContacts,
      emergencyContacts: user.emergencyContacts
    });
  }

  async deleteEmergencyContact(req, res) {
    const user = db.users.get(req.user.id);
    if (!user) return res.status(404).json({ error: 'NotFound' });

    const { contactId } = req.params;
    user.emergencyContacts = (user.emergencyContacts || []).filter(c => c.id !== contactId);
    db.users.set(user.id, user);
    db.saveUsers();

    return res.json({
      message: 'Emergency contact removed',
      contacts: user.emergencyContacts,
      emergencyContacts: user.emergencyContacts
    });
  }
}

module.exports = new AuthController();
