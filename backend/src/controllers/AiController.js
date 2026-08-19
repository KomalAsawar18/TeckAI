const recommendationService = require('../ai/recommendationService');
const logger = require('../config/logger');

class AiController {
  /**
   * Post chat request to AI Assistant
   */
  async chat(req, res, next) {
    try {
      const { message, history } = req.body;

      // Validate query presence and type
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Message is required and must be a valid string.'
          }
        });
      }

      // Enforce strict length limits to prevent abuse
      if (message.length > 500) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Message exceeds the maximum limit of 500 characters.'
          }
        });
      }

      const result = await recommendationService.getChatResponse({ 
        message: message.trim(), 
        history 
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`AiController error: ${error.message}`);
      return res.status(503).json({
        success: false,
        error: {
          message: 'The AI Assistant is currently experiencing high demand or is temporarily unavailable. Please try again in a few moments.',
          details: error.message
        }
      });
    }
  }
}

module.exports = new AiController();
