const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
      const response = await fetch(`${API_BASE}/categories`);
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
      
      const response = await fetch(url);
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
      const response = await fetch(`${API_BASE}/products/${slug}`);
      return await handleResponse(response);
    } catch (error) {
      console.error(`API Error (getProductBySlug: ${slug}):`, error.message);
      throw error;
    }
  }
};
