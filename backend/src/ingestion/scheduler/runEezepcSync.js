const crypto = require('crypto');
const logger = require('../../config/logger');
const SyncRun = require('../../models/SyncRun');
const eezepcSync = require('../sources/eezepc/sync');
const { getSyncConfig } = require('./syncConfig');

let isSyncRunning = false;

/**
 * Executes a controlled, scheduled EEZEPC synchronization.
 * Includes overlap protection, configuration limits, robust error handling,
 * structured logging, and operational persistence (SyncRun).
 */
async function runEezepcSync() {
  const syncRunId = crypto.randomUUID();
  const source = 'EEZEPC';

  // 1. Process-level overlap protection
  if (isSyncRunning) {
    logger.warn('EEZEPC sync already running. Skipping overlap.', { syncRunId, source });
    return { success: false, reason: 'sync_already_running', syncRunId };
  }

  isSyncRunning = true;
  const startedAt = new Date();
  
  // 2. Validate Configuration
  const config = getSyncConfig();
  if (!config.enabled) {
    isSyncRunning = false;
    logger.info('EEZEPC sync is disabled by configuration. Skipping run.', { syncRunId, source });
    
    // Log as skipped
    try {
      await SyncRun.create({
        source,
        syncRunId,
        startedAt,
        completedAt: new Date(),
        durationMs: 0,
        status: 'skipped'
      });
    } catch (dbErr) {
      logger.error('Failed to create skipped SyncRun record', { syncRunId, error: dbErr.message });
    }

    return { success: true, status: 'skipped', syncRunId };
  }

  // 3. Create active SyncRun operational record
  let syncRecord;
  try {
    syncRecord = await SyncRun.create({
      source,
      syncRunId,
      startedAt,
      status: 'running'
    });
  } catch (dbErr) {
    logger.error('Failed to create initial SyncRun operational record', { syncRunId, error: dbErr.message });
    // Proceed anyway - do not couple main ingestion to observability persistence failure
  }

  logger.info('Starting scheduled EEZEPC synchronization', { 
    syncRunId, 
    source, 
    maxPages: config.maxPages, 
    perPage: config.perPage 
  });

  try {
    // 4. Execute the bounded sync
    const summary = await eezepcSync.syncPages({
      startPage: 1,
      maxPages: config.maxPages,
      perPage: config.perPage
    });

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // 5. Finalize SyncRun operational record (Success)
    if (syncRecord) {
      try {
        syncRecord.status = 'success';
        syncRecord.completedAt = completedAt;
        syncRecord.durationMs = durationMs;
        syncRecord.pagesProcessed = summary.pagesProcessed;
        syncRecord.fetched = summary.fetched;
        syncRecord.supported = summary.supported;
        syncRecord.skipped = summary.skipped;
        syncRecord.created = summary.created;
        syncRecord.updated = summary.updated;
        syncRecord.failed = summary.failed;
        await syncRecord.save();
      } catch (dbErr) {
        logger.error('Failed to update SyncRun record on success', { syncRunId, error: dbErr.message });
      }
    }

    // Structured logging
    logger.info('EEZEPC synchronization completed successfully', {
      syncRunId,
      source,
      status: 'success',
      startedAt,
      completedAt,
      durationMs,
      pagesProcessed: summary.pagesProcessed,
      fetched: summary.fetched,
      supported: summary.supported,
      skipped: summary.skipped,
      created: summary.created,
      updated: summary.updated,
      failed: summary.failed
    });

    return {
      success: true,
      status: 'success',
      syncRunId,
      summary
    };

  } catch (err) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // 6. Finalize SyncRun operational record (Failed)
    if (syncRecord) {
      try {
        syncRecord.status = 'failed';
        syncRecord.completedAt = completedAt;
        syncRecord.durationMs = durationMs;
        syncRecord.errorReason = err.message || 'Unknown error';
        await syncRecord.save();
      } catch (dbErr) {
        logger.error('Failed to update SyncRun record on failure', { syncRunId, error: dbErr.message });
      }
    }

    // Structured logging for failure
    logger.error('EEZEPC synchronization failed', {
      syncRunId,
      source,
      status: 'failed',
      startedAt,
      completedAt,
      durationMs,
      errorReason: err.message
    });

    return {
      success: false,
      status: 'failed',
      syncRunId,
      reason: err.message
    };
  } finally {
    isSyncRunning = false;
  }
}

// Exposed for testing
function __resetIsSyncRunning() {
  isSyncRunning = false;
}

module.exports = {
  runEezepcSync,
  __resetIsSyncRunning
};
