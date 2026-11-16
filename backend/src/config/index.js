const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const jwtSecret = process.env.JWT_SECRET || 'help-radius-secure-dev-secret-key-2026-minimum-32-chars';

if (!jwtSecret || jwtSecret.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters in production. Server refused to start.');
  } else {
    console.warn('\n⚠️  [SECURITY WARNING] JWT_SECRET is missing or shorter than 32 characters!');
    console.warn('⚠️  Generate a secure secret using: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
  }
}

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: process.env.CLIENT_ORIGINS 
    ? process.env.CLIENT_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:8080', 'http://127.0.0.1:5173'],
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  smsProvider: process.env.SMS_PROVIDER || 'simulated',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'help-radius-prototype',
  
  // Radius Expansion Configuration (configurable per category)
  radiusConfig: {
    emergency: {
      stepsKm: [2, 5, 10, 20],
      waitSec: [30, 45, 60, 90], // accelerated for smooth demo & responsive rescue
      requiresVerifiedHelperForSafety: true
    },
    general: {
      stepsKm: [2, 5, 10],
      waitSec: [60, 120, 180]
    },
    scheduled: {
      stepsKm: [5, 10, 20],
      waitSec: [300, 600, 1200]
    }
  },

  // Pricing Configuration (transparent 3-tier breakdown in INR ₹)
  pricingConfig: {
    emergency: {
      expansionFeePerStep: 0,
      maxExpansionFee: 0,
      feeOptional: true,
      travelRatePerKm: 0,
      note: 'Emergency assistance is prioritized; no payment required.'
    },
    general: {
      expansionFeePerStep: 5,
      travelRatePerKm: 8,
      baseTravelKmFree: 2,
      maxTravelComp: 350
    },
    scheduled: {
      travelRatePerKm: 6,
      ratePerHourSuggested: 120,
      categoryMultipliers: {
        appointment_companion: 1.25,
        move_luggage: 1.5,
        shopping_companion: 1.0,
        planned_activity: 1.1
      }
    }
  }
};

module.exports = config;
