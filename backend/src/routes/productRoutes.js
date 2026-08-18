const express = require('express');
const productController = require('../controllers/ProductController');
const { protect, adminOnly } = require('../middlewares/auth');
const router = express.Router();

router.get('/', productController.getProducts);
router.get('/admin/all', protect, adminOnly, productController.getAdminProducts);
router.get('/:slug', productController.getProductBySlug);
router.post('/', protect, adminOnly, productController.createProduct);
router.put('/:id', protect, adminOnly, productController.updateProduct);

module.exports = router;
