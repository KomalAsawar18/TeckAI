const recommendationService = require('../ai/recommendationService');
const logger = require('../config/logger');
const AIConversation = require('../models/AIConversation');

class AiController {
  /**
   * Get recent conversations for authenticated user
   */
  async getConversations(req, res, next) {
    try {
      const conversations = await AIConversation.find({ user: req.user._id })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('_id title updatedAt')
        .lean();
      
      return res.status(200).json({
        success: true,
        data: conversations
      });
    } catch (error) {
      logger.error(`AiController getConversations error: ${error.message}`);
      return next(error);
    }
  }

  /**
   * Get a specific conversation by ID
   */
  async getConversationById(req, res, next) {
    try {
      const conversation = await AIConversation.findOne({ 
        _id: req.params.id, 
        user: req.user._id 
      }).lean();
      
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: { message: 'Conversation not found' }
        });
      }

      // Rehydrate products in the message history so frontend receives actual product facts
      for (const msg of conversation.messages) {
        if (msg.recommendedProductIds && msg.recommendedProductIds.length > 0) {
          msg.products = await recommendationService.rehydrateRecommendedProducts(msg.recommendedProductIds);
        } else {
          msg.products = [];
        }
      }

      return res.status(200).json({
        success: true,
        data: conversation
      });
    } catch (error) {
      logger.error(`AiController getConversationById error: ${error.message}`);
      return next(error);
    }
  }

  /**
   * Post chat request to AI Assistant
   */
  async chat(req, res, next) {
    try {
      const { message, conversationId, canonicalProductId, actionIntent } = req.body;

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
        conversationId,
        canonicalProductId,
        actionIntent,
        user: req.user // Available if softProtect found a valid token
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
          conversationId: error.conversationId || undefined
        }
      });
    }
  }
}

module.exports = new AiController();
