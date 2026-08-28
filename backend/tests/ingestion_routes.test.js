const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const { __resetIsSyncRunning } = require('../src/ingestion/scheduler/runEezepcSync');
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

describe('Ingestion Sync Routes', () => {
  beforeEach(() => {
    __resetIsSyncRunning();
    jest.restoreAllMocks();
    process.env.CRON_SECRET = 'test-secret-123';
    process.env.EEZEPC_SYNC_ENABLED = 'true';
    process.env.EEZEPC_SYNC_MAX_PAGES = '1';
    process.env.EEZEPC_SYNC_PER_PAGE = '1';
  });

  test('POST /api/ingestion/sync/eezepc rejects missing authorization header', async () => {
    const res = await request(app).post('/api/ingestion/sync/eezepc');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/ingestion/sync/eezepc rejects invalid token', async () => {
    const res = await request(app)
      .post('/api/ingestion/sync/eezepc')
      .set('Authorization', 'Bearer wrong-secret');
    
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/ingestion/sync/eezepc fails closed if CRON_SECRET env is empty', async () => {
    process.env.CRON_SECRET = '';
    const res = await request(app)
      .post('/api/ingestion/sync/eezepc')
      .set('Authorization', 'Bearer '); // Even if they match empty, it should fail closed
    
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/ingestion/sync/eezepc executes sync successfully with valid token', async () => {
    // Mock the actual ingestion to return immediately
    const mockSyncPages = jest.spyOn(syncModule, 'syncPages').mockResolvedValue({
      pagesProcessed: 1, fetched: 1, supported: 1, skipped: 0, created: 1, updated: 0, failed: 0
    });

    const res = await request(app)
      .post('/api/ingestion/sync/eezepc')
      .set('Authorization', 'Bearer test-secret-123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Sync completed');
    expect(res.body.syncRunId).toBeDefined();
    expect(res.body.summary).toBeDefined();
    expect(mockSyncPages).toHaveBeenCalled();
  });

  test('POST /api/ingestion/sync/eezepc returns 200 with skipped message if disabled', async () => {
    process.env.EEZEPC_SYNC_ENABLED = 'false';
    const mockSyncPages = jest.spyOn(syncModule, 'syncPages');

    const res = await request(app)
      .post('/api/ingestion/sync/eezepc')
      .set('Authorization', 'Bearer test-secret-123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Sync skipped (disabled by configuration)');
    expect(mockSyncPages).not.toHaveBeenCalled();
  });

  test('POST /api/ingestion/sync/eezepc returns 409 if already running', async () => {
    // Make sync hang so we can test overlap
    jest.spyOn(syncModule, 'syncPages').mockImplementation(
      () => new Promise((resolve) => setTimeout(() => {
        resolve({
          pagesProcessed: 1, fetched: 1, supported: 1, skipped: 0, created: 1, updated: 0, failed: 0
        });
      }, 200))
    );

    // Start first request but don't await immediately
    const req1Promise = request(app)
      .post('/api/ingestion/sync/eezepc')
      .set('Authorization', 'Bearer test-secret-123')
      .then(res => res); // Trigger execution immediately
    
    // Slight delay to ensure route hits the lock
    await new Promise(resolve => setTimeout(resolve, 20));

    try {
      // Second request should get 409
      const req2 = await request(app)
        .post('/api/ingestion/sync/eezepc')
        .set('Authorization', 'Bearer test-secret-123');

      expect(req2.status).toBe(409);
      expect(req2.body.success).toBe(false);
      expect(req2.body.reason).toBe('sync_already_running');
    } finally {
      // Finish first request
      const res1 = await req1Promise;
      expect(res1.status).toBe(200);
    }
  });
});
