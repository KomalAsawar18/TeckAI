const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const { protect } = require('../middlewares/auth');

// Public authentication routes
router.post('/register', (req, res, next) => authController.register(req, res, next));
router.post('/login', (req, res, next) => authController.login(req, res, next));

// Protected profile route
router.get('/me', protect, (req, res, next) => authController.getMe(req, res, next));

module.exports = router;
