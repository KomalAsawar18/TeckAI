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

  /**
   * Update authenticated user profile
   */
  async updateProfile(req, res, next) {
    try {
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' }
        });
      }

      // Explicitly pick only allowed fields
      if (req.body.name !== undefined) user.name = req.body.name;
      if (req.body.phone !== undefined) user.phone = req.body.phone;
      
      if (req.body.defaultShippingAddress) {
        if (!user.defaultShippingAddress) {
          user.defaultShippingAddress = {};
        }
        if (req.body.defaultShippingAddress.addressLine !== undefined) user.defaultShippingAddress.addressLine = req.body.defaultShippingAddress.addressLine;
        if (req.body.defaultShippingAddress.city !== undefined) user.defaultShippingAddress.city = req.body.defaultShippingAddress.city;
        if (req.body.defaultShippingAddress.postalCode !== undefined) user.defaultShippingAddress.postalCode = req.body.defaultShippingAddress.postalCode;
        if (req.body.defaultShippingAddress.country !== undefined) user.defaultShippingAddress.country = req.body.defaultShippingAddress.country;
      }

      const updatedUser = await user.save();

      logger.info(`User profile updated successfully: ${updatedUser.email}`);

      return res.status(200).json({
        success: true,
        data: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          phone: updatedUser.phone,
          defaultShippingAddress: updatedUser.defaultShippingAddress
        }
      });
    } catch (error) {
      logger.error(`UpdateProfile controller error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new AuthController();
