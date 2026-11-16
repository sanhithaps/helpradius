const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { io: ioClient } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const config = require('../src/config');
const db = require('../src/models/dataStore');
const { initIO } = require('../src/realtime/io');

let server;
let port;

test.before((t, done) => {
  server = http.createServer(app);
  initIO(server);
  server.listen(0, '127.0.0.1', () => {
    port = server.address().port;
    done();
  });
});

test.after((t, done) => {
  if (server) {
    server.close(done);
  } else {
    done();
  }
});

test('Socket.io authentication rejects connection without valid token', (t, done) => {
  const socket = ioClient(`http://127.0.0.1:${port}`, {
    auth: { token: 'invalid.jwt.token' },
    transports: ['websocket'],
    reconnection: false
  });

  socket.on('connect_error', (err) => {
    assert.ok(err.message.includes('Authentication error'), 'Must reject invalid token');
    socket.close();
    done();
  });

  socket.on('connect', () => {
    socket.close();
    done(new Error('Socket should not have connected with an invalid token'));
  });
});

test('Socket.io authentication accepts valid user token', (t, done) => {
  const testUser = {
    id: 'usr_realtime_001',
    name: 'Realtime Tester',
    email: 'realtime@example.com',
    role: 'user',
    isHelper: false
  };
  db.users.set(testUser.id, testUser);

  const token = jwt.sign({ id: testUser.id, email: testUser.email }, config.jwtSecret);

  const socket = ioClient(`http://127.0.0.1:${port}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false
  });

  socket.on('connect', () => {
    assert.strictEqual(socket.connected, true);
    socket.close();
    done();
  });

  socket.on('connect_error', (err) => {
    socket.close();
    done(err);
  });
});

test('Socket room access control: Non-participant cannot join private request room', (t, done) => {
  const outsider = {
    id: 'usr_outsider_999',
    name: 'Outsider User',
    email: 'outsider@example.com',
    role: 'user',
    isHelper: false
  };
  db.users.set(outsider.id, outsider);

  const targetRequestId = 'req_private_123';
  db.requests.set(targetRequestId, {
    id: targetRequestId,
    type: 'general',
    status: 'accepted',
    requesterId: 'usr_owner_456',
    acceptedHelperId: 'usr_helper_789'
  });

  const token = jwt.sign({ id: outsider.id, email: outsider.email }, config.jwtSecret);

  const socket = ioClient(`http://127.0.0.1:${port}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false
  });

  socket.on('connect', () => {
    socket.emit('request:join', { requestId: targetRequestId }, (res) => {
      assert.strictEqual(res.error, 'Forbidden');
      socket.close();
      done();
    });
  });

  socket.on('connect_error', (err) => {
    socket.close();
    done(err);
  });
});
