const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const apiRoutes = require('./routes/api');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));

// CORS Configuration: Allowed origins + private LAN in development
const allowedOrigins = new Set(config.clientOrigins || []);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow server-to-server or curl

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    if (config.nodeEnv !== 'production') {
      // Allow localhost with any port and local private network IPs in development
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      const isPrivateLan = /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
      if (isLocalhost || isPrivateLan) {
        return callback(null, true);
      }
    }

    return callback(new Error(`CORS blocked: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Global Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100000 : (process.env.NODE_ENV === 'production' ? 1000 : 25000),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TooManyRequests',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api', generalLimiter);

// Specific Auth Rate Limiting: 20 requests per 15 minutes (skipped during test)
if (process.env.NODE_ENV !== 'test') {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'TooManyAuthAttempts',
      message: 'Too many login or registration attempts. Please try again after 15 minutes.'
    }
  });
  app.use('/api/auth', authLimiter);

  // SOS Creation Rate Limiting: 5 requests per 10 minutes
  const sosLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'TooManySosRequests',
      message: 'Rate limit exceeded: You can create a maximum of 5 assistance requests per 10 minutes.'
    }
  });
  app.post('/api/requests', sosLimiter);
}

// Mount API routes
app.use('/api', apiRoutes);

// Root greeting & status
app.get('/', (req, res) => {
  res.json({
    project: 'Help Radius API',
    tagline: 'Location-Based Emergency and Community Assistance Platform',
    status: 'online',
    docs: '/api/health'
  });
});

// Central Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
