const logger = require('./logger');

const validateEnv = () => {
  const required = ['MONGODB_URI'];
  const missing = [];

  required.forEach(key => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    logger.error(`FATAL CONFIGURATION ERROR: Missing required environment variables: ${missing.join(', ')}`);
    logger.error('Please configure them in your .env file or deployment settings.');
    process.exit(1);
  }
};

module.exports = { validateEnv };
