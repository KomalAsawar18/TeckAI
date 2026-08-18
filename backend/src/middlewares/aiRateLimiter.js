const logger = require('../config/logger');

// Simple in-memory request counter map
const ipRequestCounts = new Map();

// Periodically clean IP request mapping to avoid leaks
setInterval(() => {
  ipRequestCounts.clear();
}, 60000); // Reset count every 1 minute

/**
 * Express middleware to rate limit requests to AI chat endpoints
 */
const aiRateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const currentCount = ipRequestCounts.get(ip) || 0;

  const LIMIT = 5; // 5 requests per minute limit

  if (currentCount >= LIMIT) {
    logger.warn(`AI Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests to the AI Assistant. Please wait a minute and try again.'
      }
    });
  }

  ipRequestCounts.set(ip, currentCount + 1);
  next();
};

module.exports = aiRateLimiter;
