const ALLOWED_HOST = 'infinitystore.pk';
const BASE_URL = 'https://infinitystore.pk/wp-json/wc/store/v1';
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Validates that the requested target URL is strictly HTTPS and targets infinitystore.pk.
 * 
 * @param {string} urlStr 
 * @returns {boolean}
 */
function isValidInfinityUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'https:' && (parsed.hostname === ALLOWED_HOST || parsed.hostname === `www.${ALLOWED_HOST}`);
  } catch {
    return false;
  }
}

/**
 * Executes a bounded, safe HTTP fetch request to Infinity Store API.
 * 
 * @param {string} endpointUrl 
 * @param {Object} [options]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{
 *   success: boolean,
 *   data?: any,
 *   pagination?: { total: number, totalPages: number, page: number, perPage: number },
 *   error?: string,
 *   statusCode?: number
 * }>}
 */
async function executeInfinityFetch(endpointUrl, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!isValidInfinityUrl(endpointUrl)) {
    return {
      success: false,
      error: 'invalid_url'
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TeckAI-Catalog-Ingestion/1.0 (Contact: admin@teckai.com)'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 429 || response.status === 403 || response.status === 502 || response.status === 503 || response.status === 504) {
      return {
        success: false,
        error: 'source_unavailable',
        statusCode: response.status
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: 'invalid_response',
        statusCode: response.status
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        error: 'unexpected_content',
        statusCode: response.status
      };
    }

    const data = await response.json();

    const totalHeader = response.headers.get('x-wp-total');
    const totalPagesHeader = response.headers.get('x-wp-totalpages');

    const total = totalHeader !== null ? parseInt(totalHeader, 10) : undefined;
    const totalPages = totalPagesHeader !== null ? parseInt(totalPagesHeader, 10) : undefined;

    return {
      success: true,
      data,
      pagination: {
        total: Number.isNaN(total) ? undefined : total,
        totalPages: Number.isNaN(totalPages) ? undefined : totalPages
      }
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'timeout'
      };
    }
    return {
      success: false,
      error: 'network_error'
    };
  }
}

/**
 * Fetches a page of products from the public WooCommerce Store API on Infinity Store.
 * 
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.perPage=10]
 * @param {number} [params.timeoutMs=10000]
 * @returns {Promise<{
 *   success: boolean,
 *   data?: Array<Object>,
 *   pagination?: { total: number, totalPages: number, page: number, perPage: number },
 *   error?: string,
 *   statusCode?: number
 * }>}
 */
async function fetchProducts({ page = 1, perPage = 10, category = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePerPage = Math.min(100, Math.max(1, parseInt(perPage, 10) || 10));
  let url = `${BASE_URL}/products?page=${safePage}&per_page=${safePerPage}`;
  if (category !== null && category !== undefined && String(category).trim().length > 0) {
    url += `&category=${encodeURIComponent(String(category).trim())}`;
  }

  const result = await executeInfinityFetch(url, { timeoutMs });
  if (result.success && result.pagination) {
    result.pagination.page = safePage;
    result.pagination.perPage = safePerPage;
  }
  return result;
}

/**
 * Fetches product categories from Infinity Store.
 * 
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.perPage=100]
 * @param {number} [params.timeoutMs=10000]
 * @returns {Promise<{
 *   success: boolean,
 *   data?: Array<Object>,
 *   error?: string,
 *   statusCode?: number
 * }>}
 */
async function fetchCategories({ page = 1, perPage = 100, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePerPage = Math.min(100, Math.max(1, parseInt(perPage, 10) || 100));
  const url = `${BASE_URL}/products/categories?page=${safePage}&per_page=${safePerPage}`;
  return executeInfinityFetch(url, { timeoutMs });
}

/**
 * Fetches a single product by WooCommerce product ID from Infinity Store.
 * 
 * @param {number|string} productId 
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=10000]
 * @returns {Promise<{
 *   success: boolean,
 *   data?: Object,
 *   error?: string,
 *   statusCode?: number
 * }>}
 */
async function fetchProduct(productId, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!productId || typeof productId !== 'number' && typeof productId !== 'string') {
    return {
      success: false,
      error: 'invalid_id'
    };
  }
  const cleanId = String(productId).trim();
  const url = `${BASE_URL}/products/${encodeURIComponent(cleanId)}`;
  return executeInfinityFetch(url, { timeoutMs });
}

module.exports = {
  fetchProducts,
  fetchProduct,
  fetchCategories,
  isValidInfinityUrl,
  ALLOWED_HOST,
  BASE_URL
};
