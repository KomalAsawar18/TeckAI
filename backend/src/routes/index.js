const express = require('express');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const aiRoutes = require('./aiRoutes');
const authRoutes = require('./authRoutes');
const cartRoutes = require('./cartRoutes');

const router = express.Router();

router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/ai', aiRoutes);
router.use('/auth', authRoutes);
router.use('/cart', cartRoutes);

module.exports = router;
