const express = require('express');
const router = express.Router();
const aiController = require('../controllers/AiController');
const aiRateLimiter = require('../middlewares/aiRateLimiter');

// AI Assistant Chat query - Rate limited
router.post('/chat', aiRateLimiter, (req, res, next) => aiController.chat(req, res, next));

module.exports = router;
