const express = require('express');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const aiRoutes = require('./aiRoutes');
const authRoutes = require('./authRoutes');
const cartRoutes = require('./cartRoutes');
const wishlistRoutes = require('./wishlistRoutes');
const orderRoutes = require('./orderRoutes');
const userRoutes = require('./userRoutes');
const ingestionRoutes = require('./ingestionRoutes');
const offerRoutes = require('./offerRoutes');
const canonicalProductRoutes = require('./canonicalProductRoutes');

const router = express.Router();

router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/ai', aiRoutes);
router.use('/auth', authRoutes);
router.use('/cart', cartRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/orders', orderRoutes);
router.use('/users', userRoutes);
router.use('/ingestion/sync', ingestionRoutes);
router.use('/offers', offerRoutes);
router.use('/canonical-products', canonicalProductRoutes);

module.exports = router;
