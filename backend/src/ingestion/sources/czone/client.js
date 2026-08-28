const { URL } = require('url');

/**
 * Validates whether the supplied URL is a valid HTTP/HTTPS URL and belongs to Czone Pakistan domain.
 * 
 * @param {string} urlStr - The URL to validate
 * @returns {boolean} True if valid Czone URL, false otherwise
 */
function validateCzoneUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host === 'czone.com.pk' || host === 'www.czone.com.pk' || host.endsWith('.czone.com.pk');
  } catch (err) {
    return false;
  }
}

/**
 * Fetches the HTML content of a single Czone product page without anti-bot circumvention.
 * 
 * @param {string} url - The product page URL
 * @returns {Promise<Object>} The result object conforming to the result contract
 */
async function fetchProductPage(url) {
  if (!validateCzoneUrl(url)) {
    return {
      success: false,
      reason: 'invalid_url'
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000); // 10-second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    clearTimeout(timeoutId);

    // Check for unexpected non-HTML content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return {
        success: false,
        reason: 'unexpected_content',
        status: response.status
      };
    }

    if (!response.ok) {
      return {
        success: false,
        reason: 'source_unavailable',
        status: response.status
      };
    }

    const html = await response.text();
    return {
      success: true,
      rawStatus: response.status,
      html
    };

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return {
        success: false,
        reason: 'timeout'
      };
    }

    return {
      success: false,
      reason: 'network_error'
    };
  }
}

module.exports = {
  fetchProductPage,
  validateCzoneUrl
};
