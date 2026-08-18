const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/WishlistController');
const { protect } = require('../middlewares/auth');

// Protected Wishlist routes
router.get('/', protect, (req, res, next) => wishlistController.getWishlist(req, res, next));
router.post('/', protect, (req, res, next) => wishlistController.addToWishlist(req, res, next));
router.delete('/:productId', protect, (req, res, next) => wishlistController.removeFromWishlist(req, res, next));

module.exports = router;
