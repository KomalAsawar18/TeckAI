const express = require('express');
const router = express.Router();
const aiController = require('../controllers/AiController');
const aiRateLimiter = require('../middlewares/aiRateLimiter');
const { protect, softProtect } = require('../middlewares/auth');

// Get recent conversations for authenticated user
router.get('/conversations', protect, (req, res, next) => aiController.getConversations(req, res, next));

// Get specific conversation for authenticated user
router.get('/conversations/:id', protect, (req, res, next) => aiController.getConversationById(req, res, next));

// AI Assistant Chat query - Rate limited (soft protected for optional persistence)
router.post('/chat', softProtect, aiRateLimiter, (req, res, next) => aiController.chat(req, res, next));

module.exports = router;
