const http = require('http');
const app = require('./app');
const config = require('./config');
const radiusEngine = require('./services/radiusEngine');
const { initIO } = require('./realtime/io');

const server = http.createServer(app);

// Initialize Socket.io Realtime Engine
initIO(server);

// Start the Automatic Radius Expansion Engine Background Worker
radiusEngine.start();

const PORT = config.port || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log(`🚀 Help Radius Backend API Server Running on port ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`⏰ Radius Expansion Worker Active: checking requests`);
  console.log('================================================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server and radius worker.');
  radiusEngine.stop();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
