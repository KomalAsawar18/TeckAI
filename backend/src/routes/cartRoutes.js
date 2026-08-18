const express = require('express');
const router = express.Router();
const cartController = require('../controllers/CartController');
const { protect } = require('../middlewares/auth');

// Protected Cart routes
router.get('/', protect, (req, res, next) => cartController.getCart(req, res, next));
router.put('/', protect, (req, res, next) => cartController.updateCart(req, res, next));

module.exports = router;
