const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Force test environment
process.env.NODE_ENV = 'test';

// CRITICAL ISOLATION RULE: Tests must never have access to production/development MONGODB_URI
if (process.env.MONGODB_URI) {
  // Store reference to test URI if not explicitly defined
  if (!process.env.MONGODB_TEST_URI && process.env.MONGODB_URI.includes('teckai')) {
    // Generate teckai_test from MONGODB_URI as safe fallback only if it explicitly specifies teckai_test
  }
  delete process.env.MONGODB_URI;
}

const { isTestDbName } = require('./testDb');

// Install global pre-hook guard on mongoose deleteMany to prevent wiping any non-test database
const originalDeleteMany = mongoose.Model.deleteMany;
mongoose.Model.deleteMany = function (conditions, options, callback) {
  if (mongoose.connection.readyState === 1) {
    const activeDb = mongoose.connection.name;
    if (!isTestDbName(activeDb)) {
      throw new Error(
        `CRITICAL SAFETY GUARD: Blocked deleteMany on model '${this.modelName}'. ` +
        `Active database '${activeDb}' does not contain 'test'. Tests must run against a test database only.`
      );
    }
  }
  return originalDeleteMany.apply(this, arguments);
};

// Global timeout
jest.setTimeout(60000);
