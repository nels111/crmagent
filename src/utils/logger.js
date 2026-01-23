/**
 * Logger Utility
 * Centralized logging with different log levels
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

/**
 * Format log message with timestamp
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 * @returns {string} Formatted log message
 */
function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}`;
}

/**
 * Log error message
 * @param {string} message - Error message
 * @param {object} meta - Additional metadata
 */
function error(message, meta = {}) {
  if (currentLogLevel >= LOG_LEVELS.error) {
    console.error(formatLog('error', message, meta));
  }
}

/**
 * Log warning message
 * @param {string} message - Warning message
 * @param {object} meta - Additional metadata
 */
function warn(message, meta = {}) {
  if (currentLogLevel >= LOG_LEVELS.warn) {
    console.warn(formatLog('warn', message, meta));
  }
}

/**
 * Log info message
 * @param {string} message - Info message
 * @param {object} meta - Additional metadata
 */
function info(message, meta = {}) {
  if (currentLogLevel >= LOG_LEVELS.info) {
    console.log(formatLog('info', message, meta));
  }
}

/**
 * Log debug message
 * @param {string} message - Debug message
 * @param {object} meta - Additional metadata
 */
function debug(message, meta = {}) {
  if (currentLogLevel >= LOG_LEVELS.debug) {
    console.log(formatLog('debug', message, meta));
  }
}

module.exports = {
  error,
  warn,
  info,
  debug,
};
