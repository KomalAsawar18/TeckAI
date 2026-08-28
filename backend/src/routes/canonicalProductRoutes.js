const express = require('express');
const {
  getCanonicalProducts,
  getCanonicalProduct,
  getCanonicalProductOffers
} = require('../controllers/canonicalProductController');

const router = express.Router();

// GET /api/canonical-products - List canonical catalog with best-offer summaries
router.get('/', getCanonicalProducts);

// GET /api/canonical-products/:id - Single canonical product read with best offer summary
router.get('/:id', getCanonicalProduct);

// GET /api/canonical-products/:id/offers - Retrieve detailed ranked offers & comparison
router.get('/:id/offers', getCanonicalProductOffers);

module.exports = router;
