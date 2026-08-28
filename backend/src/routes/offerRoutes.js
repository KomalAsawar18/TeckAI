const express = require('express');
const { redirectOffer } = require('../commerce/redirectOffer');

const router = express.Router();

/**
 * GET /api/offers/:offerId/redirect
 * 
 * Safely redirects the client to the resolved destination (affiliate URL or sourceUrl fallback),
 * while logging a privacy-preserving OfferClick event.
 * 
 * Query parameters:
 * - context: optional client context (e.g. 'product_page', 'comparison', 'search', etc.)
 * 
 * Error responses:
 * - 400 Bad Request: Invalid offer ID format
 * - 404 Not Found: Offer does not exist
 * - 410 Gone: Offer is inactive or discontinued
 * - 422 Unprocessable Entity: No valid destination URL available
 */
router.get('/:offerId/redirect', async (req, res, next) => {
  try {
    const { offerId } = req.params;
    const { context } = req.query;

    const result = await redirectOffer(offerId, { context });

    if (result.success && result.destinationUrl) {
      return res.redirect(result.destinationUrl);
    }

    return res.status(result.status || 500).json({
      success: false,
      message: result.error || 'Unable to redirect offer'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
