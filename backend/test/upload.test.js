const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = require('../src/app');

let server;
let baseUrl;

test.before((t, done) => {
  server = http.createServer(app);
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
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

test('Upload API accepts and persists local device image files', async () => {
  const boundary = '----WebKitFormBoundaryTest123456';
  const dummyImageContent = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');

  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample_tyre.gif"\r\nContent-Type: image/gif\r\n\r\n`),
    dummyImageContent,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: payload
  });

  assert.strictEqual(res.status, 201, 'Should return HTTP 201 Created');
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.file.type, 'image');
  assert.ok(data.file.url.startsWith('/uploads/'), 'URL should point to /uploads/');

  // Verify static file serving
  const fileRes = await fetch(`${baseUrl}${data.file.url}`);
  assert.strictEqual(fileRes.status, 200, 'Uploaded file must be accessible via static route');
});

test('Upload API accepts and persists local device video files', async () => {
  const boundary = '----WebKitFormBoundaryTestVideo';
  const dummyVideoContent = Buffer.from('ftypmp42\x00\x00\x00\x00isommp42');

  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="breakdown_clip.mp4"\r\nContent-Type: video/mp4\r\n\r\n`),
    dummyVideoContent,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: payload
  });

  assert.strictEqual(res.status, 201, 'Should return HTTP 201 Created');
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.file.type, 'video');
  assert.ok(data.file.url.startsWith('/uploads/'), 'Video URL must point to /uploads/');
});

test('Upload API accepts and persists local device audio voice notes', async () => {
  const boundary = '----WebKitFormBoundaryTestAudio';
  const dummyAudioContent = Buffer.from('\x1aE\xdf\xa3dummy-webm-audio-header');

  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="voice_note.webm"\r\nContent-Type: audio/webm\r\n\r\n`),
    dummyAudioContent,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: payload
  });

  assert.strictEqual(res.status, 201, 'Should return HTTP 201 Created');
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.file.type, 'audio');
  assert.ok(data.file.url.startsWith('/uploads/'), 'Audio URL must point to /uploads/');

  // Verify static file serving for audio
  const fileRes = await fetch(`${baseUrl}${data.file.url}`);
  assert.strictEqual(fileRes.status, 200, 'Uploaded audio must be streamable via static route');
});
