/**
 * Parses and validates EEZEPC synchronization configuration from environment variables.
 */
function getSyncConfig() {
  const isEnabled = process.env.EEZEPC_SYNC_ENABLED === 'true';
  
  // Parse Max Pages with conservative fallback
  let maxPages = 3; // default conservative
  if (process.env.EEZEPC_SYNC_MAX_PAGES) {
    const parsedMax = parseInt(process.env.EEZEPC_SYNC_MAX_PAGES, 10);
    if (!isNaN(parsedMax) && parsedMax > 0 && parsedMax <= 50) {
      maxPages = parsedMax;
    }
  }

  // Parse Per Page with conservative fallback
  let perPage = 10;
  if (process.env.EEZEPC_SYNC_PER_PAGE) {
    const parsedPer = parseInt(process.env.EEZEPC_SYNC_PER_PAGE, 10);
    if (!isNaN(parsedPer) && parsedPer >= 1 && parsedPer <= 100) {
      perPage = parsedPer;
    }
  }

  return {
    enabled: isEnabled,
    maxPages,
    perPage
  };
}

module.exports = {
  getSyncConfig
};
