const BASE_URL = 'https://eezepc.com/wp-json/wc/store/v1';

/**
 * Validates pagination inputs.
 */
function validatePagination(page, perPage) {
  const p = Number(page);
  const pp = Number(perPage);
  return Number.isInteger(p) && p >= 1 && Number.isInteger(pp) && pp >= 1 && pp <= 100;
}

/**
 * Validates product ID input.
 */
function validateId(id) {
  if (id === undefined || id === null) return false;
  const num = Number(id);
  return Number.isInteger(num) && num > 0;
}

/**
 * Fetches a list of products from the public EEZEPC WooCommerce Store API.
 * 
 * @param {Object} params
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.perPage=10] - Products per page
 * @param {string|number} [params.category] - Category ID or slug to target
 * @returns {Promise<Object>} The result contract
 */
async function fetchProducts({ page = 1, perPage = 10, category = null } = {}) {
  if (!validatePagination(page, perPage)) {
    return {
      success: false,
      reason: 'invalid_arguments'
    };
  }

  let url = `${BASE_URL}/products?page=${page}&per_page=${perPage}`;
  if (category !== null && category !== undefined && String(category).trim().length > 0) {
    url += `&category=${encodeURIComponent(String(category).trim())}`;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000); // 10-second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TeckAI-Ingestion-Agent/1.0'
      }
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
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

    const products = await response.json();
    return {
      success: true,
      rawStatus: response.status,
      products
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

/**
 * Fetches a single product from the public EEZEPC WooCommerce Store API.
 * 
 * @param {number|string} id - Product ID
 * @returns {Promise<Object>} The result contract
 */
async function fetchProduct(id) {
  if (!validateId(id)) {
    return {
      success: false,
      reason: 'invalid_arguments'
    };
  }

  const url = `${BASE_URL}/products/${id}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000); // 10-second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TeckAI-Ingestion-Agent/1.0'
      }
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
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

    const product = await response.json();
    return {
      success: true,
      rawStatus: response.status,
      product
    };

  } catch (error) {
    clearTimeout(timeoutId);

    return {
      success: false,
      reason: 'network_error'
    };
  }
}

/**
 * Fetches product categories from the public EEZEPC WooCommerce Store API.
 * 
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.perPage=100]
 * @returns {Promise<Object>} The result contract
 */
async function fetchCategories({ page = 1, perPage = 100 } = {}) {
  if (!validatePagination(page, perPage)) {
    return {
      success: false,
      reason: 'invalid_arguments'
    };
  }

  const url = `${BASE_URL}/products/categories?page=${page}&per_page=${perPage}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TeckAI-Ingestion-Agent/1.0'
      }
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
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

    const categories = await response.json();
    return {
      success: true,
      rawStatus: response.status,
      categories
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
  fetchProducts,
  fetchProduct,
  fetchCategories,
  validatePagination,
  validateId
};
