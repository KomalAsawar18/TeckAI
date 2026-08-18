require('dotenv').config();
const { validateEnv } = require('./src/config/env');

// Run env validation before starting database and app
validateEnv();

const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Start Express listener
    app.listen(PORT, () => {
      logger.info(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Fatal server start error: ${error.message}`);
    process.exit(1);
  }
};

startServer();
