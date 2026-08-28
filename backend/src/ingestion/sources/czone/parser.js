const cheerio = require('cheerio');

/**
 * Parses Czone product detail page HTML and extracts raw fields.
 * 
 * @param {string} html - HTML page source
 * @param {string} [url] - Optional source URL
 * @returns {Object} Raw Czone data payload
 */
function parseProductHtml(html, url) {
  if (!html) {
    throw new Error('HTML content is required');
  }

  const $ = cheerio.load(html);

  // 1. Title
  const title = $('#spName').text().trim() || $('h1').first().text().trim();

  // 2. Product Code / Listing ID
  let productCode = '';
  $('*').each((i, el) => {
    const text = $(el).text();
    if (text.includes('Product Code:')) {
      const match = text.match(/Product Code:\s*([A-Za-z0-9-]+)/i);
      if (match) {
        productCode = match[1].trim();
        return false; // break loop
      }
    }
  });
  if (!productCode) {
    productCode = $('.product-code').text().replace(/Product Code:\s*/i, '').trim();
  }

  // 3. Price
  let priceText = '';
  const priceNew = $('.price-new').text().trim();
  const priceReg = $('.price-reg').text().trim();
  const mainPrice = $('.product-price, [itemprop="price"]').text().trim();
  priceText = priceNew || mainPrice || priceReg;

  // 4. Availability
  let availability = '';
  const availStatus = $('.stock-status, .availability, .stock').text().trim();
  if (availStatus) {
    availability = availStatus;
  } else {
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      if (text === 'In Stock' || text === 'Out Of Stock' || text === 'Pre-Order') {
        availability = text;
        return false; // break
      }
    });
  }

  // 5. Brand
  let brand = '';
  brand = $('.brand, [itemprop="brand"]').text().trim();
  if (!brand) {
    const breadcrumb = $('.breadcrumb li').eq(2).text().trim();
    if (breadcrumb) {
      brand = breadcrumb;
    }
  }

  // 6. Image
  let imageUrl = '';
  const imgEl = $('#zoom_01, .product-image img, [itemprop="image"]').first();
  imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';

  // 7. Specifications / Features
  const features = {};
  $('.table-bordered tr, .spec-table tr, table.product-info tr').each((i, el) => {
    const cells = $(el).find('td');
    if (cells.length >= 2) {
      const key = $(cells[0]).text().trim();
      const val = $(cells[1]).text().trim();
      if (key && val) {
        features[key] = val;
      }
    }
  });

  // 8. Rating and Reviews (optional)
  let rating = '';
  let reviewCount = '';
  const ratingText = $('.rating-count, .rating').text().trim();
  if (ratingText) {
    rating = ratingText;
  }
  const reviewText = $('.review-count, .reviews').text().trim();
  if (reviewText) {
    reviewCount = reviewText;
  }

  // Optional exact stock quantity if genuinely present (e.g. "5 items left")
  let stock;
  const stockQtyText = $('.stock-quantity').text().trim();
  if (stockQtyText) {
    const match = stockQtyText.match(/(\d+)/);
    if (match) {
      stock = parseInt(match[1], 10);
    }
  }

  // category raw text from breadcrumbs
  let categoryRaw = '';
  const catEl = $('.breadcrumb li').eq(1).text().trim();
  if (catEl) {
    categoryRaw = catEl;
  } else {
    categoryRaw = $('.category-title').text().trim();
  }

  return {
    productCode,
    title,
    brandRaw: brand,
    priceText,
    url,
    categoryRaw,
    imageUrl,
    features,
    availability,
    rating,
    reviewCount,
    stock
  };
}

module.exports = {
  parseProductHtml
};
