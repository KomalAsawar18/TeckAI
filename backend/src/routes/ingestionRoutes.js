const express = require('express');
const crypto = require('crypto');
const { runEezepcSync } = require('../ingestion/scheduler/runEezepcSync');
const logger = require('../config/logger');

const router = express.Router();

// Middleware to protect ingestion routes using CRON_SECRET
const requireCronSecret = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Parse Bearer token safely
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = parts[1];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || expectedSecret.trim() === '') {
    logger.warn('CRON_SECRET is missing or empty in environment. Failing closed.');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const tokenBuffer = Buffer.from(token, 'utf8');
  const secretBuffer = Buffer.from(expectedSecret, 'utf8');

  // Compare lengths first to prevent timingSafeEqual throwing an error for unequal lengths
  if (tokenBuffer.length !== secretBuffer.length) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (!crypto.timingSafeEqual(tokenBuffer, secretBuffer)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  next();
};

/**
 * POST /api/ingestion/sync/eezepc
 * Protected endpoint for triggering the EEZEPC synchronization job.
 */
router.post('/eezepc', requireCronSecret, async (req, res) => {
  try {
    // We await the synchronization to finish and return the result to the caller.
    // If execution continued asynchronously, we would return "Sync triggered", 
    // but here we are waiting for it.
    const result = await runEezepcSync();
    
    if (!result.success) {
      if (result.reason === 'sync_already_running') {
        return res.status(409).json({ success: false, reason: result.reason });
      }
      return res.status(500).json({ success: false, reason: result.reason });
    }

    if (result.status === 'skipped') {
      return res.status(200).json({ success: true, message: 'Sync skipped (disabled by configuration)' });
    }

    return res.status(200).json({
      success: true,
      message: 'Sync completed',
      syncRunId: result.syncRunId,
      summary: result.summary
    });
  } catch (err) {
    logger.error('Unexpected error in /eezepc ingestion route', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
