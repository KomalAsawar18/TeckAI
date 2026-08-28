const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');

/**
 * Resolves a category input (ID, slug, or name) dynamically from the database.
 * 
 * @param {*} categoryInput - Category ID string/ObjectId, slug, or name
 * @returns {Promise<mongoose.Types.ObjectId|null>} Resolved Category ID or null
 */
async function resolveCategory(categoryInput) {
  if (!categoryInput) {
    return null;
  }
  
  // 1. Check if it's a valid mongoose ObjectId
  if (mongoose.Types.ObjectId.isValid(categoryInput)) {
    const cat = await Category.findById(categoryInput);
    if (cat) return cat._id;
  }
  
  // 2. Try match by slug or name (case-insensitive)
  if (typeof categoryInput === 'string') {
    const trimmedInput = categoryInput.trim();
    const cat = await Category.findOne({
      $or: [
        { slug: trimmedInput.toLowerCase() },
        { name: new RegExp('^' + trimmedInput.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
      ]
    });
    if (cat) return cat._id;
  }
  
  return null;
}

/**
 * Safely inserts or updates a normalized product in MongoDB.
 * 
 * @param {Object} normalizedProduct - Product data normalized by normalizeProduct()
 * @returns {Promise<Object>} Promise resolving to { product, operation: 'created' | 'updated' }
 */
async function upsertProduct(normalizedProduct) {
  // 1. Identity validation
  if (!normalizedProduct.source || !normalizedProduct.source.name || !normalizedProduct.source.listingId) {
    throw new Error('source.name and source.listingId are required for external upsert');
  }

  const sourceName = String(normalizedProduct.source.name).trim();
  const sourceListingId = String(normalizedProduct.source.listingId).trim();
  if (sourceName.length === 0 || sourceListingId.length === 0) {
    throw new Error('source.name and source.listingId cannot be empty');
  }

  // 2. Category resolution & validation
  const resolvedCategoryId = await resolveCategory(normalizedProduct.category);
  if (!resolvedCategoryId) {
    throw new Error(`Category cannot be resolved: ${normalizedProduct.category}`);
  }
  normalizedProduct.category = resolvedCategoryId;

  // 3. Search for existing product with the same external identity
  let product = await Product.findOne({
    'source.name': sourceName,
    'source.listingId': sourceListingId
  });

  let operation = 'updated';

  if (!product) {
    operation = 'created';
    
    // Auto-generate required unique slug if missing
    let finalSlug = normalizedProduct.slug;
    if (!finalSlug && normalizedProduct.name) {
      finalSlug = normalizedProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (!finalSlug) {
      finalSlug = `ext-${sourceName.toLowerCase()}-${sourceListingId.toLowerCase()}`;
    }

    // Ensure slug is globally unique (in case of manual product collisions)
    const baseSlug = finalSlug;
    let count = 0;
    while (true) {
      const existing = await Product.findOne({ slug: finalSlug });
      if (!existing) break;
      count++;
      finalSlug = `${baseSlug}-${count}`;
    }

    // Auto-generate required unique SKU if missing
    let finalSku = normalizedProduct.sku;
    if (!finalSku) {
      finalSku = `EXT-${sourceName.substring(0, 3).toUpperCase()}-${sourceListingId.toUpperCase()}`;
    }
    // Clean and ensure unique SKU
    finalSku = finalSku.replace(/[^A-Z0-9-]/ig, '').toUpperCase();
    const baseSku = finalSku;
    let skuCount = 0;
    while (true) {
      const existing = await Product.findOne({ sku: finalSku });
      if (!existing) break;
      skuCount++;
      finalSku = `${baseSku}-${skuCount}`;
    }

    // Create a new instance
    product = new Product({
      ...normalizedProduct,
      slug: finalSlug,
      sku: finalSku
    });
  } else {
    // Update existing document fields
    const fieldsToSync = [
      'name', 'brand', 'description', 'price', 'currency', 'condition', 
      'images', 'specifications', 'rating', 'reviewCount', 'stock', 'availability', 
      'category', 'source', 'seller', 'isActive', 'isFeatured', 'tags'
    ];

    for (const field of fieldsToSync) {
      if (normalizedProduct[field] !== undefined) {
        product[field] = normalizedProduct[field];
      }
    }
  }

  // 4. Force lastSyncedAt to current server time
  if (!product.source) {
    product.source = {};
  }
  product.source.lastSyncedAt = new Date();

  // 5. Save and return
  await product.save();
  return { product, operation };
}

module.exports = { upsertProduct, resolveCategory };
