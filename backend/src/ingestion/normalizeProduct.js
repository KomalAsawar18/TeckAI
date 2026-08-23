/**
 * Normalizes raw connector data into the standard Product model schema format.
 * Includes strict validation constraints.
 * 
 * @param {Object} rawData - Raw data from a connector
 * @returns {Object} Normalized product data ready for Mongoose insertion/upsert
 */
function normalizeProduct(rawData) {
  if (!rawData) {
    throw new Error('Product data is missing');
  }

  // 1. Name validation & normalization
  if (rawData.name === undefined || rawData.name === null) {
    throw new Error('Product name is required');
  }
  const name = typeof rawData.name === 'string' ? rawData.name.trim() : String(rawData.name).trim();
  if (name.length === 0) {
    throw new Error('Product name is required');
  }

  // 2. Price validation & normalization
  if (rawData.price === undefined || rawData.price === null) {
    throw new Error('Product price is required');
  }
  const price = Number(rawData.price);
  if (isNaN(price)) {
    throw new Error('Product price must be a valid number');
  }
  if (price < 0) {
    throw new Error('Product price cannot be negative');
  }

  // 3. Condition validation & normalization
  let condition = 'new';
  if (rawData.condition !== undefined && rawData.condition !== null && rawData.condition !== '') {
    const rawCond = String(rawData.condition).trim().toLowerCase();
    if (rawCond !== 'new' && rawCond !== 'refurbished' && rawCond !== 'used') {
      throw new Error(`Unsupported condition: ${rawData.condition}`);
    }
    condition = rawCond;
  }

  // 4. Source URL validation & normalization (optional)
  let source = undefined;
  if (rawData.source) {
    const src = rawData.source;
    
    // Trim listing ID and name
    const srcType = src.type ? String(src.type).trim().toLowerCase() : undefined;
    const srcName = src.name && String(src.name).trim() !== '' ? String(src.name).trim() : undefined;
    const srcListingId = src.listingId && String(src.listingId).trim() !== '' ? String(src.listingId).trim() : undefined;
    
    let srcUrl = undefined;
    if (src.url && String(src.url).trim() !== '') {
      const trimmedUrl = String(src.url).trim();
      try {
        const parsedUrl = new URL(trimmedUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          throw new Error('URL must use http or https protocol');
        }
        srcUrl = trimmedUrl;
      } catch (err) {
        throw new Error(`Invalid source URL: ${err.message}`);
      }
    }

    // Build source object if any fields are present
    if (srcType || srcName || srcListingId || srcUrl || src.lastSyncedAt) {
      source = {};
      if (srcType) source.type = srcType;
      if (srcName) source.name = srcName;
      if (srcListingId) source.listingId = srcListingId;
      if (srcUrl) source.url = srcUrl;
      if (src.lastSyncedAt) {
        source.lastSyncedAt = src.lastSyncedAt instanceof Date ? src.lastSyncedAt : new Date(src.lastSyncedAt);
      }
    }
  }

  // 5. Seller normalization
  let seller = undefined;
  if (rawData.seller) {
    const sel = rawData.seller;
    const selName = sel.name && String(sel.name).trim() !== '' ? String(sel.name).trim() : undefined;
    const selType = sel.type ? String(sel.type).trim().toLowerCase() : undefined;
    const selLocation = sel.location && String(sel.location).trim() !== '' ? String(sel.location).trim() : undefined;

    if (selType && selType !== 'retailer' && selType !== 'business' && selType !== 'individual') {
      throw new Error(`Unsupported seller type: ${sel.type}`);
    }

    if (selName || selType || selLocation) {
      seller = {};
      if (selName) seller.name = selName;
      if (selType) seller.type = selType;
      if (selLocation) seller.location = selLocation;
    }
  }

  // 6. Basic fields normalization
  const brand = rawData.brand && typeof rawData.brand === 'string' ? rawData.brand.trim() : rawData.brand;
  const description = rawData.description && typeof rawData.description === 'string' ? rawData.description.trim() : rawData.description;
  const slug = rawData.slug && typeof rawData.slug === 'string' ? rawData.slug.trim() : rawData.slug;
  const sku = rawData.sku && typeof rawData.sku === 'string' ? rawData.sku.trim() : rawData.sku;
  const currency = rawData.currency && typeof rawData.currency === 'string' ? rawData.currency.trim() : 'PKR';
  
  // Format arrays/objects with fallbacks
  const images = Array.isArray(rawData.images) ? rawData.images.map(img => String(img).trim()) : [];
  const specifications = rawData.specifications && typeof rawData.specifications === 'object' ? rawData.specifications : {};
  const tags = Array.isArray(rawData.tags) ? rawData.tags.map(t => String(t).trim()) : [];

  // Normalize rating / reviewCount only when valid
  let rating = undefined;
  if (rawData.rating !== undefined && rawData.rating !== null) {
    const r = Number(rawData.rating);
    if (!isNaN(r) && r >= 0 && r <= 5) {
      rating = r;
    }
  }

  let reviewCount = undefined;
  if (rawData.reviewCount !== undefined && rawData.reviewCount !== null) {
    const rc = Number(rawData.reviewCount);
    if (!isNaN(rc) && rc >= 0) {
      reviewCount = rc;
    }
  }

  // 7. Stock and Availability normalization
  let stock = undefined;
  if (rawData.stock !== undefined && rawData.stock !== null && rawData.stock !== '') {
    const s = Number(rawData.stock);
    if (isNaN(s)) {
      throw new Error('Product stock must be a valid number');
    }
    if (s < 0) {
      throw new Error('Product stock cannot be negative');
    }
    stock = s;
  }

  let availability = 'unknown';
  if (rawData.availability !== undefined && rawData.availability !== null && rawData.availability !== '') {
    const rawAvail = String(rawData.availability).trim().toLowerCase().replace(/\s+/g, '_');
    if (rawAvail === 'in_stock' || rawAvail === 'out_of_stock' || rawAvail === 'unknown') {
      availability = rawAvail;
    } else {
      throw new Error(`Unsupported availability: ${rawData.availability}`);
    }
  } else if (stock !== undefined) {
    availability = stock > 0 ? 'in_stock' : 'out_of_stock';
  }

  // Build normalized output
  const normalized = {
    name,
    price,
    condition,
    currency,
    images,
    specifications,
    tags,
    availability
  };

  // Pass through existing fields
  if (brand !== undefined) normalized.brand = brand;
  if (description !== undefined) normalized.description = description;
  if (slug !== undefined) normalized.slug = slug;
  if (sku !== undefined) normalized.sku = sku;
  if (stock !== undefined) normalized.stock = stock;
  if (rawData.category !== undefined) normalized.category = rawData.category;
  if (rawData.isFeatured !== undefined) normalized.isFeatured = Boolean(rawData.isFeatured);
  if (rawData.isActive !== undefined) normalized.isActive = Boolean(rawData.isActive);

  if (rating !== undefined) normalized.rating = rating;
  if (reviewCount !== undefined) normalized.reviewCount = reviewCount;
  if (source !== undefined) normalized.source = source;
  if (seller !== undefined) normalized.seller = seller;

  return normalized;
}

module.exports = { normalizeProduct };
