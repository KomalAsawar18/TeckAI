const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Helper to fetch headers, dynamically appending bearer tokens from local cache
 * @param {string|null} [contentType='application/json']
 * @returns {Object}
 */
const getHeaders = (contentType = 'application/json') => {
  const headers = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Handle fetch response wrapper
 */
const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.error?.message || 'Something went wrong';
    throw new Error(errorMsg);
  }
  return data;
};

export const api = {
  /**
   * Fetch active categories for filters
   */
  async getCategories() {
    try {
      const response = await fetch(`${API_BASE}/categories`, {
        headers: getHeaders(null)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('API Error (getCategories):', error.message);
      throw error;
    }
  },

  /**
   * Fetch paginated and filtered products list
   */
  async getProducts(params = {}) {
    try {
      const query = new URLSearchParams();
      
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          query.append(key, params[key]);
        }
      });

      const queryString = query.toString();
      const url = `${API_BASE}/products${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        headers: getHeaders(null)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('API Error (getProducts):', error.message);
      throw error;
    }
  },

  /**
   * Fetch product detail by slug
   */
  async getProductBySlug(slug) {
    try {
      const response = await fetch(`${API_BASE}/products/${slug}`, {
        headers: getHeaders(null)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error(`API Error (getProductBySlug: ${slug}):`, error.message);
      throw error;
    }
  },

  /**
   * Send chat message to AI assistant
   */
  async sendAiChat(message, history = []) {
    try {
      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message, history })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('API Error (sendAiChat):', error.message);
      throw error;
    }
  },

  /**
   * Authenticate credentials
   */
  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, password })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('API Error (login):', error.message);
      throw error;
    }
  },

  /**
   * Register account
   */
  async register(name, email, password) {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, email, password })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('API Error (register):', error.message);
      throw error;
    }
  },

  /**
   * Retrieve active session profile
   */
  async getMe() {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: getHeaders(null)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('API Error (getMe):', error.message);
      throw error;
    }
  },

  /**
   * Fetch user's wishlist
   */
  async getWishlist() {
    try {
      const response = await fetch(`${API_BASE}/wishlist`, {
        headers: getHeaders(null)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('API Error (getWishlist):', error.message);
      throw error;
    }
  },

  /**
   * Add a product reference to user's wishlist
   */
  async addToWishlist(productId) {
    try {
      const response = await fetch(`${API_BASE}/wishlist`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ productId })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error(`API Error (addToWishlist for ${productId}):`, error.message);
      throw error;
    }
  },

  /**
   * Remove a product reference from user's wishlist
   */
  async removeFromWishlist(productId) {
    try {
      const response = await fetch(`${API_BASE}/wishlist/${productId}`, {
        method: 'DELETE',
        headers: getHeaders(null)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error(`API Error (removeFromWishlist for ${productId}):`, error.message);
      throw error;
    }
  }
};
