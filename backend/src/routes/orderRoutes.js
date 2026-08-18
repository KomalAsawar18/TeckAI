const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');
const { protect, adminOnly } = require('../middlewares/auth');

// All order endpoints require authentication
router.post('/', protect, OrderController.createOrder);
router.get('/', protect, OrderController.getUserOrders);
router.get('/admin/all', protect, adminOnly, OrderController.getAllOrders);
router.get('/:id', protect, OrderController.getOrderById);
router.put('/:id/status', protect, adminOnly, OrderController.updateOrderStatus);

module.exports = router;
