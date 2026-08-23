/**
 * Czone Source Connector Client
 * 
 * Responsible only for retrieving raw source data.
 * No database or persistence logic should be placed here.
 * Network/Scraping libraries are not implemented yet in this step.
 */

/**
 * Fetches raw HTML of a product page by URL.
 * 
 * @param {string} url - Product detail page URL
 * @returns {Promise<Object>} Raw scraped payload structure (mocked)
 */
async function fetchProductData(url) {
  // TODO: Implement browser automation or HTTP request header rotation to bypass Cloudflare
  throw new Error('Network fetching is not implemented yet in this step');
}

/**
 * Fetches raw list of product URLs/Codes from a category listing page.
 * 
 * @param {string} categoryUrl - Category listing page URL
 * @returns {Promise<Array<string>>} List of product URLs
 */
async function fetchCategoryListings(categoryUrl) {
  // TODO: Implement category crawl logic
  throw new Error('Network fetching is not implemented yet in this step');
}

module.exports = {
  fetchProductData,
  fetchCategoryListings
};
