const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Returns the backend API origin (e.g. http://localhost:5000 or https://teckai-backend.vercel.app)
 * @returns {string}
 */
export const getApiOrigin = () => {
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string') {
    if (envApiUrl.startsWith('http://') || envApiUrl.startsWith('https://')) {
      return envApiUrl.replace(/\/api\/?$/, '');
    }
  }
  // In development mode, default to backend server port 5000
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  // In browser runtime on localhost / 127.0.0.1
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000';
  }
  return '';
};

/**
 * Builds the fully-qualified backend offer redirect URL.
 * Routes directly to the backend /api/offers/:id/redirect endpoint, which returns 302 to the retailer.
 * @param {Object|string} offerOrPath - ProductOffer object or relative redirect path
 * @returns {string}
 */
export const getOfferRedirectUrl = (offerOrPath) => {
  if (!offerOrPath) return '#';
  let path = '';
  if (typeof offerOrPath === 'string') {
    path = offerOrPath;
  } else if (typeof offerOrPath === 'object') {
    const offerId = offerOrPath.id || offerOrPath._id;
    path = offerOrPath.redirectUrl || (offerId ? `/api/offers/${offerId}/redirect` : '#');
  }

  if (!path || path === '#') return '#';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const origin = getApiOrigin();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
};

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
    const err = new Error(errorMsg);
    err.payload = data.error;
    throw err;
  }
  return data;
};

/**
 * Centralized request helper
 */
const request = async (endpoint, options = {}) => {
  const { method = 'GET', body, headers: customHeaders } = options;
  const headers = getHeaders(body ? 'application/json' : null);
  
  if (customHeaders) {
    Object.assign(headers, customHeaders);
  }

  const fetchOptions = { method, headers };
  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);
    return await handleResponse(response);
  } catch (error) {
    console.error(`API Error (${method} ${endpoint}):`, error.message);
    throw error;
  }
};

export const api = {
  /**
   * Fetch active categories for filters
   */
  getCategories() {
    return request('/categories');
  },

  /**
   * Fetch paginated and filtered products list (Legacy)
   */
  getProducts(params = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    const queryString = query.toString();
    return request(`/products${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Fetch paginated and filtered canonical catalog products
   */
  getCanonicalProducts(params = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    const queryString = query.toString();
    return request(`/canonical-products${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Fetch single canonical product summary by ID
   */
  getCanonicalProduct(id, params = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    const queryString = query.toString();
    return request(`/canonical-products/${id}${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Fetch detailed ranked offers comparison for a canonical product
   */
  getCanonicalProductOffers(id, params = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    const queryString = query.toString();
    return request(`/canonical-products/${id}/offers${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Fetch product detail by slug (Legacy)
   */
  getProductBySlug(slug) {
    return request(`/products/${slug}`);
  },

  /**
   * Send chat message to AI assistant
   */
  sendAiChat(message, options = {}) {
    return request('/ai/chat', {
      method: 'POST',
      body: { 
        message, 
        conversationId: options.conversationId,
        canonicalProductId: options.canonicalProductId,
        actionIntent: options.actionIntent
      }
    });
  },

  /**
   * Get authenticated user's recent AI conversations
   */
  getAiConversations() {
    return request('/ai/conversations');
  },

  /**
   * Get a specific AI conversation by ID
   */
  getAiConversationById(id) {
    return request(`/ai/conversations/${id}`);
  },

  /**
   * Authenticate credentials
   */
  login(email, password) {
    return request('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
  },

  /**
   * Register account
   */
  register(name, email, password) {
    return request('/auth/register', {
      method: 'POST',
      body: { name, email, password }
    });
  },

  /**
   * Retrieve active session profile
   */
  getMe() {
    return request('/auth/me');
  },

  /**
   * Update active session profile
   */
  updateProfile(profileData) {
    return request('/auth/me', {
      method: 'PUT',
      body: profileData
    });
  },

  /**
   * Fetch user's wishlist
   */
  getWishlist() {
    return request('/wishlist');
  },

  /**
   * Add a product reference to user's wishlist
   */
  addToWishlist(productId) {
    return request('/wishlist', {
      method: 'POST',
      body: { productId }
    });
  },

  /**
   * Remove a product reference from user's wishlist
   */
  removeFromWishlist(productId) {
    return request(`/wishlist/${productId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Place an order (Checkout)
   */
  createOrder(shippingAddress) {
    return request('/orders', {
      method: 'POST',
      body: { shippingAddress }
    });
  },

  /**
   * Retrieve current user's order history
   */
  getUserOrders() {
    return request('/orders');
  },

  /**
   * Retrieve detailed info for a single order
   */
  getOrderById(orderId) {
    return request(`/orders/${orderId}`);
  },

  /**
   * Admin: Retrieve all platform orders
   */
  adminGetOrders() {
    return request('/orders/admin/all');
  },

  /**
   * Admin: Update the status tag of a user's order
   */
  adminUpdateOrderStatus(orderId, status) {
    return request(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: { status }
    });
  },

  /**
   * Admin: Add a new catalog product
   */
  adminCreateProduct(productData) {
    return request('/products', {
      method: 'POST',
      body: productData
    });
  },

  /**
   * Admin: Edit details of a catalog product
   */
  adminUpdateProduct(productId, productData) {
    return request(`/products/${productId}`, {
      method: 'PUT',
      body: productData
    });
  },

  /**
   * Admin: Create a new filter category
   */
  adminCreateCategory(categoryData) {
    return request('/categories', {
      method: 'POST',
      body: categoryData
    });
  },

  /**
   * Admin: Retrieve all registered platform users
   */
  adminGetUsers() {
    return request('/users');
  },

  /**
   * Admin: Retrieve all products (active and inactive)
   */
  adminGetProducts() {
    return request('/products/admin/all');
  },

  /**
   * Fetch the authenticated user's remote cart
   */
  getCart() {
    return request('/cart');
  },

  /**
   * Replace the entire cart with a new items array (used for sync & merge)
   * @param {Array<{product: string, quantity: number}>} items
   */
  updateCart(items) {
    return request('/cart', {
      method: 'PUT',
      body: { items }
    });
  },

  /**
   * Add or increment a single item in the remote cart
   * @param {string} productId
   * @param {number} quantity
   */
  addItemToCart(productId, quantity = 1) {
    return request('/cart', {
      method: 'POST',
      body: { productId, quantity }
    });
  },

  /**
   * Remove a single item from the remote cart
   * @param {string} productId
   */
  removeCartItem(productId) {
    return request(`/cart/${productId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Helper to build fully qualified backend redirect URL
   */
  getOfferRedirectUrl
};
