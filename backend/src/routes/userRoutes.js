const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { protect, adminOnly } = require('../middlewares/auth');

// Admin-only user list retrieval
router.get('/', protect, adminOnly, UserController.getAllUsers);

module.exports = router;
