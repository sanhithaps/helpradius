const { test } = require('node:test');
const assert = require('node:assert');
const smsService = require('../src/services/smsService');

test('Phone normalization converts 10-digit numbers to E.164 format (+91...) and keeps existing +', () => {
  assert.strictEqual(smsService.normalizePhone('9876543210'), '+919876543210');
  assert.strictEqual(smsService.normalizePhone('+14155552671'), '+14155552671');
  assert.strictEqual(smsService.normalizePhone('919876543210'), '+919876543210');
});

test('Simulated SMS provider returns status "simulated" and NEVER "delivered"', async () => {
  const result = await smsService.sendEmergencyAlert({
    contactName: 'Alice',
    contactPhone: '9876543210',
    requesterName: 'Bob',
    category: 'medical',
    location: { lat: 12.9716, lng: 77.5946 },
    requestId: 'req_test_123'
  });

  assert.strictEqual(result.status, 'simulated');
  assert.notStrictEqual(result.status, 'delivered');
  assert.match(result.deliveryBadge, /Simulated/i);
});

test('Twilio fallback: Missing credentials gracefully falls back to simulated without crashing', async () => {
  const oldProvider = process.env.SMS_PROVIDER;
  const oldSid = process.env.TWILIO_ACCOUNT_SID;
  process.env.SMS_PROVIDER = 'twilio';
  delete process.env.TWILIO_ACCOUNT_SID;

  const result = await smsService.sendEmergencyAlert({
    contactName: 'Charlie',
    contactPhone: '9876543211',
    requesterName: 'Bob',
    category: 'police',
    location: { lat: 12.9716, lng: 77.5946 },
    requestId: 'req_test_456'
  });

  assert.strictEqual(result.status, 'simulated');
  assert.notStrictEqual(result.status, 'delivered');

  process.env.SMS_PROVIDER = oldProvider;
  if (oldSid) process.env.TWILIO_ACCOUNT_SID = oldSid;
});
