const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { runEezepcSync, __resetIsSyncRunning } = require('../src/ingestion/scheduler/runEezepcSync');
const SyncRun = require('../src/models/SyncRun');
const syncModule = require('../src/ingestion/sources/eezepc/sync');

require('dotenv').config();
let mongoServer;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  let uri = process.env.MONGODB_URI;
  if (uri) {
    if (uri.includes('?')) {
      const parts = uri.split('?');
      if (parts[0].endsWith('/')) parts[0] += 'teckai_test';
      else parts[0] = parts[0].substring(0, parts[0].lastIndexOf('/') + 1) + 'teckai_test';
      uri = parts.join('?');
    } else {
      if (uri.endsWith('/')) uri += 'teckai_test';
      else {
        const lastSlash = uri.lastIndexOf('/');
        if (lastSlash > uri.indexOf('://') + 2) uri = uri.substring(0, lastSlash + 1) + 'teckai_test';
        else uri += '/teckai_test';
      }
    }
    await mongoose.connect(uri);
  } else {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('EEZEPC Scheduler Tests', () => {
  beforeEach(async () => {
    await SyncRun.deleteMany({});
    __resetIsSyncRunning();
    jest.restoreAllMocks();
    
    // Default valid env config for testing
    process.env.EEZEPC_SYNC_ENABLED = 'true';
    process.env.EEZEPC_SYNC_MAX_PAGES = '3';
    process.env.EEZEPC_SYNC_PER_PAGE = '10';
  });

  test('successfully runs sync, saves SyncRun model, and passes limits', async () => {
    // Mock the underlying syncPages
    const mockSyncPages = jest.spyOn(syncModule, 'syncPages').mockResolvedValue({
      pagesProcessed: 2,
      fetched: 20,
      supported: 15,
      skipped: 5,
      created: 10,
      updated: 5,
      failed: 0
    });

    const result = await runEezepcSync();

    expect(result.success).toBe(true);
    expect(result.status).toBe('success');
    expect(result.syncRunId).toBeDefined();
    
    expect(mockSyncPages).toHaveBeenCalledWith({
      startPage: 1,
      maxPages: 3,
      perPage: 10
    });

    const runDoc = await SyncRun.findOne({ syncRunId: result.syncRunId });
    expect(runDoc).toBeDefined();
    expect(runDoc.status).toBe('success');
    expect(runDoc.pagesProcessed).toBe(2);
    expect(runDoc.created).toBe(10);
    expect(runDoc.completedAt).toBeDefined();
    expect(runDoc.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('disabled sync returns skipped and creates skipped SyncRun', async () => {
    process.env.EEZEPC_SYNC_ENABLED = 'false';
    const mockSyncPages = jest.spyOn(syncModule, 'syncPages');

    const result = await runEezepcSync();

    expect(result.success).toBe(true);
    expect(result.status).toBe('skipped');
    expect(mockSyncPages).not.toHaveBeenCalled();

    const runDoc = await SyncRun.findOne({ syncRunId: result.syncRunId });
    expect(runDoc).toBeDefined();
    expect(runDoc.status).toBe('skipped');
    expect(runDoc.pagesProcessed).toBe(0);
  });

  test('overlap protection prevents concurrent runs', async () => {
    // Make syncPages hang
    jest.spyOn(syncModule, 'syncPages').mockImplementation(
      () => new Promise((resolve) => setTimeout(() => {
        resolve({
          pagesProcessed: 1, fetched: 10, supported: 5, skipped: 5, created: 2, updated: 3, failed: 0
        });
      }, 100))
    );

    // Start first run
    const run1Promise = runEezepcSync();
    
    try {
      // Start second run immediately
      const run2 = await runEezepcSync();

      expect(run2.success).toBe(false);
      expect(run2.reason).toBe('sync_already_running');
    } finally {
      // Wait for first to finish
      const run1 = await run1Promise;
      if (!run1.success) console.log('run1 failed:', run1.reason);
      expect(run1.success).toBe(true);
    }
  });

  test('sync failure is caught safely and logged to SyncRun', async () => {
    jest.spyOn(syncModule, 'syncPages').mockRejectedValue(new Error('Network disconnected'));

    const result = await runEezepcSync();

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.reason).toBe('Network disconnected');

    const runDoc = await SyncRun.findOne({ syncRunId: result.syncRunId });
    expect(runDoc).toBeDefined();
    expect(runDoc.status).toBe('failed');
    expect(runDoc.errorReason).toBe('Network disconnected');
  });

  test('invalid config limits fall back to safe conservative defaults', async () => {
    process.env.EEZEPC_SYNC_MAX_PAGES = '999999'; // too big
    process.env.EEZEPC_SYNC_PER_PAGE = '-5'; // invalid

    const mockSyncPages = jest.spyOn(syncModule, 'syncPages').mockResolvedValue({
      pagesProcessed: 1, fetched: 0, supported: 0, skipped: 0, created: 0, updated: 0, failed: 0
    });

    await runEezepcSync();

    expect(mockSyncPages).toHaveBeenCalledWith({
      startPage: 1,
      maxPages: 3, // fallback
      perPage: 10 // fallback
    });
  });
});
