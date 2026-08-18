const express = require('express');
const productController = require('../controllers/ProductController');
const router = express.Router();

router.get('/', productController.getProducts);
router.get('/:slug', productController.getProductBySlug);

module.exports = router;
