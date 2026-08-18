const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

// Retrieve JWT secret from environment, fallback for safety
const JWT_SECRET = process.env.JWT_SECRET || 'teckai_default_dev_secret_key_12345';

/**
 * Protect routes - Authenticate JWT token
 */
const protect = async (req, res, next) => {
  let token;

  // Check for Bearer token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Access denied. No authentication token provided.'
      }
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch user details and attach to request
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User associated with this token no longer exists.'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn(`JWT validation failed: ${error.message}`);
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or expired authentication token.'
      }
    });
  }
};

/**
 * Authorize roles - Admin route guard
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Access denied. Admin privileges are required.'
      }
    });
  }
};

module.exports = { protect, adminOnly };
