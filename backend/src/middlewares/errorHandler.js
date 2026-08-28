const logger = require('../config/logger');
const AppError = require('../errors/AppError');

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
  }

  // Defaults
  if (!statusCode) {
    statusCode = 500;
  }
  
  // Clean up message for unexpected internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';
  const isOperational = err instanceof AppError || err.isOperational;

  if (statusCode === 500 && isProduction) {
    message = 'Internal server error';
  }

  // Log the error
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.stack || message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} - ${statusCode} - ${message}`);
  }

  const response = {
    success: false,
    error: {
      message
    }
  };

  // Include stack trace only in non-production environments
  if (!isProduction && statusCode === 500) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
