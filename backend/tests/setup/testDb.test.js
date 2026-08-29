const mongoose = require('mongoose');
const {
  extractDbName,
  isTestDbName,
  verifyTestDatabaseSafety,
  connectTestDB,
  disconnectTestDB,
  safeClearTestModels
} = require('./testDb');
const User = require('../../src/models/User');

describe('Test Database Isolation & Fail-Closed Guards', () => {
  const originalTestUri = process.env.MONGODB_TEST_URI;

  afterAll(async () => {
    process.env.MONGODB_TEST_URI = originalTestUri;
    await disconnectTestDB();
  });

  test('extractDbName correctly extracts database name from standard and SRV URIs', () => {
    expect(extractDbName('mongodb://localhost:27017/teckai_test')).toBe('teckai_test');
    expect(extractDbName('mongodb+srv://user:pass@cluster.mongodb.net/teckai_test?retryWrites=true')).toBe('teckai_test');
    expect(extractDbName('mongodb://localhost:27017/teckai')).toBe('teckai');
    expect(extractDbName('')).toBe('');
    expect(extractDbName(null)).toBe('');
  });

  test('isTestDbName enforces that database name must contain "test"', () => {
    expect(isTestDbName('teckai_test')).toBe(true);
    expect(isTestDbName('test_db')).toBe(true);
    expect(isTestDbName('TESTING')).toBe(true);
    expect(isTestDbName('teckai')).toBe(false);
    expect(isTestDbName('production')).toBe(false);
    expect(isTestDbName('teckai_prod')).toBe(false);
    expect(isTestDbName('')).toBe(false);
  });

  test('connectTestDB throws when MONGODB_TEST_URI is missing or unset', async () => {
    delete process.env.MONGODB_TEST_URI;
    await expect(connectTestDB()).rejects.toThrow(/MONGODB_TEST_URI is required/i);
    process.env.MONGODB_TEST_URI = originalTestUri;
  });

  test('connectTestDB throws when MONGODB_TEST_URI points to a non-test database (e.g. teckai)', async () => {
    process.env.MONGODB_TEST_URI = 'mongodb://localhost:27017/teckai';
    await expect(connectTestDB()).rejects.toThrow(/does NOT contain "test"/i);
    process.env.MONGODB_TEST_URI = originalTestUri;
  });

  test('connectTestDB connects successfully to verified test database (teckai_test)', async () => {
    await connectTestDB();
    expect(mongoose.connection.readyState).toBe(1);
    expect(mongoose.connection.name.toLowerCase()).toContain('test');
  });

  test('verifyTestDatabaseSafety passes when connected to test database', () => {
    expect(() => verifyTestDatabaseSafety()).not.toThrow();
  });

  test('safeClearTestModels verifies safety before allowing delete operations', async () => {
    await safeClearTestModels([User]);
    expect(await User.countDocuments()).toBe(0);
  });
});
