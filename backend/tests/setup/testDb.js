const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Ensure env is loaded
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Extracts database name from MongoDB URI string safely without exposing credentials
 * @param {string} uri
 * @returns {string} database name
 */
function extractDbName(uri) {
  if (!uri || typeof uri !== 'string') return '';
  try {
    const withoutQuery = uri.split('?')[0];
    const slashIdx = withoutQuery.lastIndexOf('/');
    if (slashIdx !== -1) {
      return withoutQuery.substring(slashIdx + 1);
    }
  } catch (err) {
    return '';
  }
  return '';
}

/**
 * Strict safety check ensuring a database name explicitly contains 'test'
 * @param {string} dbName
 * @returns {boolean}
 */
function isTestDbName(dbName) {
  if (!dbName || typeof dbName !== 'string') return false;
  return dbName.toLowerCase().includes('test');
}

/**
 * Asserts that the currently active mongoose connection is strictly a test database.
 * Throws an uncatchable safety error if not connected to a test database.
 */
function verifyTestDatabaseSafety() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('CRITICAL TEST GUARD: Mongoose is not connected. Aborting test operation.');
  }

  const activeDbName = mongoose.connection.name || (mongoose.connection.db && mongoose.connection.db.databaseName);
  if (!isTestDbName(activeDbName)) {
    throw new Error(
      `CRITICAL TEST SAFETY GUARD: Active database is '${activeDbName}', which does NOT contain 'test'. ` +
      'All test write/delete operations are aborted immediately to protect production/development data.'
    );
  }
}

/**
 * Connects strictly to MONGODB_TEST_URI.
 * Refuses to connect if MONGODB_TEST_URI is missing or does not contain 'test'.
 * Jest tests MUST NEVER use MONGODB_URI.
 */
async function connectTestDB() {
  process.env.NODE_ENV = 'test';

  const testUri = process.env.MONGODB_TEST_URI;
  if (!testUri) {
    throw new Error(
      'CRITICAL TEST CONFIGURATION ERROR: process.env.MONGODB_TEST_URI is required for running tests. ' +
      'Tests must NEVER use MONGODB_URI. Please define MONGODB_TEST_URI in your .env pointing to a database containing "test".'
    );
  }

  const targetDbName = extractDbName(testUri);
  if (!isTestDbName(targetDbName)) {
    throw new Error(
      `CRITICAL TEST SAFETY GUARD: MONGODB_TEST_URI target database name is '${targetDbName}', ` +
      'which does NOT contain "test". Refusing to connect to prevent destructive operations on non-test databases.'
    );
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testUri);
  }

  // Double check connected database name
  const connectedDbName = mongoose.connection.name;
  if (!isTestDbName(connectedDbName)) {
    await mongoose.disconnect();
    throw new Error(
      `CRITICAL TEST SAFETY GUARD: Connected to database '${connectedDbName}', which does NOT contain "test". ` +
      'Connection terminated immediately.'
    );
  }

  return mongoose.connection;
}

/**
 * Disconnects mongoose safely
 */
async function disconnectTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Safe database cleanup helper for tests
 * Guarantees verifyTestDatabaseSafety before calling deleteMany
 * @param {Array<mongoose.Model>} models
 */
async function safeClearTestModels(models = []) {
  verifyTestDatabaseSafety();
  for (const model of models) {
    if (model && typeof model.deleteMany === 'function') {
      await model.deleteMany({});
    }
  }
}

module.exports = {
  extractDbName,
  isTestDbName,
  verifyTestDatabaseSafety,
  connectTestDB,
  disconnectTestDB,
  safeClearTestModels
};
