const test = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const db = require('../src/models/dataStore');
const { toPublicUser } = require('../src/utils/userUtils');

test('Password hashing with bcryptjs on user registration', async () => {
  const plainPassword = 'SecretPassword123!';
  const hash = await bcrypt.hash(plainPassword, 10);

  // Must not be plain text
  assert.notStrictEqual(hash, plainPassword);
  assert.ok(hash.startsWith('$2'), 'Bcrypt hash should start with $2');

  // Verify compare works
  const match = await bcrypt.compare(plainPassword, hash);
  assert.strictEqual(match, true);

  const wrongMatch = await bcrypt.compare('WrongPassword999!', hash);
  assert.strictEqual(wrongMatch, false);
});

test('toPublicUser never exposes password, passwordHash, or raw ID numbers', () => {
  const mockUser = {
    id: 'usr_mock_123',
    name: 'Privacy User',
    email: 'privacy@example.com',
    phone: '+919876543210',
    password: 'plain_password',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
    verificationId: 'AADH-9988-7766-5544',
    idType: 'Aadhaar Card',
    role: 'user',
    isHelper: false
  };

  const publicData = toPublicUser(mockUser);

  // Sensitive fields must be stripped completely
  assert.strictEqual(publicData.password, undefined);
  assert.strictEqual(publicData.passwordHash, undefined);
  assert.strictEqual(publicData.verificationId, undefined);

  // Must expose masked ID only
  assert.strictEqual(publicData.idLast4, 'XXXX-XXXX-5544');
  assert.strictEqual(publicData.email, 'privacy@example.com');
  assert.strictEqual(publicData.role, 'user');
});

test('Non-admin user role guard enforces 403 Forbidden', () => {
  const { requireAdmin } = require('../src/middleware/auth');

  let statusCode = 0;
  let responseBody = {};

  const req = {
    user: { id: 'usr_normal_001', role: 'user' }
  };
  const res = {
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseBody = data;
          return data;
        }
      };
    }
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  requireAdmin(req, res, next);

  assert.strictEqual(statusCode, 403);
  assert.strictEqual(responseBody.error, 'Forbidden');
  assert.strictEqual(nextCalled, false);
});

test('Admin user role guard allows admin access', () => {
  const { requireAdmin } = require('../src/middleware/auth');

  let nextCalled = false;
  const req = {
    user: { id: 'usr_admin_001', role: 'admin' }
  };
  const res = {
    status: () => ({ json: () => {} })
  };
  const next = () => { nextCalled = true; };

  requireAdmin(req, res, next);

  assert.strictEqual(nextCalled, true);
});

test('Request access control: Non-participant user receives 403 Forbidden', async () => {
  const requestController = require('../src/controllers/requestController');

  const testRequestId = 'req_sec_test_' + Date.now();
  db.requests.set(testRequestId, {
    id: testRequestId,
    type: 'emergency',
    requesterId: 'usr_owner_001',
    acceptedHelperId: 'usr_helper_001',
    status: 'accepted',
    location: { lat: 12.97, lng: 77.59 }
  });

  let statusCode = 0;
  let responseData = {};

  // User 3 is an unrelated outsider
  const req = {
    params: { id: testRequestId },
    user: { id: 'usr_stranger_999', role: 'user', isHelper: false }
  };
  const res = {
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseData = data;
          return data;
        }
      };
    }
  };

  await requestController.getRequestById(req, res);

  assert.strictEqual(statusCode, 403);
  assert.strictEqual(responseData.error, 'Forbidden');
});
