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
   * Fetch paginated and filtered products list
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
   * Fetch product detail by slug
   */
  getProductBySlug(slug) {
    return request(`/products/${slug}`);
  },

  /**
   * Send chat message to AI assistant
   */
  sendAiChat(message, history = []) {
    return request('/ai/chat', {
      method: 'POST',
      body: { message, history }
    });
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
  }
};
