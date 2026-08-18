const express = require('express');
const router = express.Router();
const recommendationService = require('../ai/recommendationService');
const BadRequestError = require('../errors/BadRequestError');
const aiRateLimiter = require('../middlewares/aiRateLimiter');

// Rate limiting and validation checks inside route handler
router.post('/chat', aiRateLimiter, async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      throw new BadRequestError('Message is required and must be a non-empty string');
    }

    // Input length limit for safety & cost controls
    if (message.length > 500) {
      throw new BadRequestError('Message exceeds maximum limit of 500 characters');
    }

    const result = await recommendationService.getChatResponse({
      message: message.trim(),
      history: history || []
    });

    res.json({
      success: true,
      data: {
        response: result.response,
        products: result.products
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
