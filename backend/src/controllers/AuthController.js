const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

// JWT Secret key configuration
const JWT_SECRET = process.env.JWT_SECRET || 'teckai_default_dev_secret_key_12345';

/**
 * Generate a JWT token signed with the user ID
 * @param {string} userId 
 * @returns {string}
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: '30d'
  });
};

class AuthController {
  /**
   * Register a new user
   */
  async register(req, res, next) {
    try {
      const { name, email, password } = req.body;

      // Validate query parameters presence
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Please provide name, email, and password.'
          }
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Password must be at least 6 characters long.'
          }
        });
      }

      // Check if user already exists
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Email is already registered.'
          }
        });
      }

      // Create new user (automatically hashed pre-save)
      const user = await User.create({
        name,
        email,
        password
      });

      const token = generateToken(user._id);

      logger.info(`User registered successfully: ${user.email} (ID: ${user._id})`);

      return res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        }
      });
    } catch (error) {
      logger.error(`Register controller error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Login user
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Validate credentials presence
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Please provide email and password.'
          }
        });
      }

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid email or password.'
          }
        });
      }

      // Match entered password to database hashed password
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid email or password.'
          }
        });
      }

      const token = generateToken(user._id);

      logger.info(`User logged in successfully: ${user.email}`);

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        }
      });
    } catch (error) {
      logger.error(`Login controller error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get current authenticated user details
   */
  async getMe(req, res, next) {
    try {
      // req.user is populated by protect middleware
      return res.status(200).json({
        success: true,
        data: req.user
      });
    } catch (error) {
      logger.error(`GetMe controller error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new AuthController();
