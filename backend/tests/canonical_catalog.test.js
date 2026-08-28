const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const app = require('../src/app');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const Category = require('../src/models/Category');

describe('Step 3E.1 — Canonical Catalog Read API & Frontend Readiness Tests', () => {
  let keyboardCat;
  let monitorCat;
  let ajazzCanonical;
  let asusCanonical;
  let outOfStockCanonical;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Ensure categories exist
    keyboardCat = await Category.findOneAndUpdate(
      { slug: 'keyboards' },
      { name: 'Keyboards', slug: 'keyboards', isActive: true },
      { upsert: true, new: true }
    );

    monitorCat = await Category.findOneAndUpdate(
      { slug: 'monitors' },
      { name: 'Monitors', slug: 'monitors', isActive: true },
      { upsert: true, new: true }
    );
  });

  beforeEach(async () => {
    await ProductOffer.deleteMany({});
    await CanonicalProduct.deleteMany({});

    // 1. Create Ajazz AK680 V2 Keyboard with 2 offers (10,500 and 12,000)
    ajazzCanonical = await CanonicalProduct.create({
      name: 'Ajazz AK680 V2 Magnetic Switch Gaming Keyboard',
      brand: 'Ajazz',
      model: 'AK680V2',
      canonicalKey: 'ajazz|ak680v2',
      category: keyboardCat._id,
      specifications: { brand: 'Ajazz', switch: 'Magnetic' },
      images: ['https://infinitystore.pk/uploads/ajazz-1.jpg'],
      isActive: true
    });

    await ProductOffer.create({
      canonicalProduct: ajazzCanonical._id,
      seller: { name: 'Infinity Store Pakistan' },
      source: { name: 'INFINITY_STORE', listingId: '68919', url: 'https://infinitystore.pk/p/68919' },
      sourceUrl: 'https://infinitystore.pk/p/68919',
      price: 10500,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: { color: 'Starry Sky Gray' },
      affiliate: {
        enabled: true,
        url: 'https://affiliate.example.com/track?partner=infinity&secret=SECRET_KEY_123',
        network: 'custom_affiliate'
      },
      lastSyncedAt: new Date('2026-08-20T10:00:00Z'),
      isActive: true
    });

    await ProductOffer.create({
      canonicalProduct: ajazzCanonical._id,
      seller: { name: 'Infinity Store Pakistan' },
      source: { name: 'INFINITY_STORE', listingId: '68911', url: 'https://infinitystore.pk/p/68911' },
      sourceUrl: 'https://infinitystore.pk/p/68911',
      price: 12000,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      variant: { color: 'Black Contour' },
      lastSyncedAt: new Date('2026-08-20T11:00:00Z'),
      isActive: true
    });

    // 2. Create ASUS ROG Monitor with 1 offer (55,000)
    asusCanonical = await CanonicalProduct.create({
      name: 'ASUS ROG Strix 32-inch Gaming Monitor',
      brand: 'ASUS',
      model: 'XG32UCWG',
      canonicalKey: 'asus|xg32ucwg',
      category: monitorCat._id,
      specifications: { brand: 'ASUS', refreshRate: '240Hz' },
      images: ['https://eezepc.com/uploads/asus-1.jpg'],
      isActive: true
    });

    await ProductOffer.create({
      canonicalProduct: asusCanonical._id,
      seller: { name: 'EEZEPC' },
      source: { name: 'EEZEPC', listingId: '291149', url: 'https://eezepc.com/p/291149' },
      sourceUrl: 'https://eezepc.com/p/291149',
      price: 55000,
      currency: 'PKR',
      availability: 'in_stock',
      condition: 'new',
      lastSyncedAt: new Date('2026-08-21T10:00:00Z'),
      isActive: true
    });

    // 3. Create an Out-of-Stock Canonical Product
    outOfStockCanonical = await CanonicalProduct.create({
      name: 'Razer DeathAdder V3 Pro Wireless Gaming Mouse',
      brand: 'Razer',
      model: 'RZ01-04630100',
      canonicalKey: 'razer|rz0104630100',
      category: keyboardCat._id,
      specifications: { brand: 'Razer' },
      images: [],
      isActive: true
    });

    await ProductOffer.create({
      canonicalProduct: outOfStockCanonical._id,
      seller: { name: 'EEZEPC' },
      source: { name: 'EEZEPC', listingId: '999999', url: 'https://eezepc.com/p/999999' },
      sourceUrl: 'https://eezepc.com/p/999999',
      price: 25000,
      currency: 'PKR',
      availability: 'out_of_stock',
      condition: 'new',
      isActive: true
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('1. Catalog Listing & Default Availability Exclusion', () => {
    it('returns active canonical products with eligible best offers by default', async () => {
      const res = await request(app).get('/api/canonical-products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.products.length).toBe(2); // Out of stock product is excluded by default

      const ajazz = res.body.products.find(p => p.id === ajazzCanonical._id.toString());
      expect(ajazz).toBeDefined();
      expect(ajazz.name).toBe('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard');
      expect(ajazz.brand).toBe('Ajazz');
      expect(ajazz.model).toBe('AK680V2');
      expect(ajazz.offerCount).toBe(2);
      expect(ajazz.sellerCount).toBe(1);
      expect(ajazz.sourceCount).toBe(1);
      expect(ajazz.bestOffer).toBeDefined();
      expect(ajazz.bestOffer.price).toBe(10500);
      expect(ajazz.bestOffer.redirectUrl).toBe(`/api/offers/${ajazz.bestOffer.id}/redirect`);

      // Security checks: ensure raw affiliate url or credentials are not exposed
      expect(JSON.stringify(res.body)).not.toContain('SECRET_KEY_123');
      expect(JSON.stringify(res.body)).not.toContain('affiliateUrl');
      expect(JSON.stringify(res.body)).not.toContain('https://affiliate.example.com');
    });

    it('includes unavailable/out-of-stock products when includeUnavailable=true is requested', async () => {
      const res = await request(app).get('/api/canonical-products?includeUnavailable=true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.products.length).toBe(3);

      const oos = res.body.products.find(p => p.id === outOfStockCanonical._id.toString());
      expect(oos).toBeDefined();
      expect(oos.bestOffer).toBeDefined();
      expect(oos.bestOffer.availability).toBe('out_of_stock');
    });
  });

  describe('2. Filtering (Category, Brand, Search, Price Bounds)', () => {
    it('filters canonical catalog by category slug', async () => {
      const res = await request(app).get('/api/canonical-products?category=monitors');

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].name).toContain('ASUS ROG');
    });

    it('returns empty list when non-existent category is requested', async () => {
      const res = await request(app).get('/api/canonical-products?category=non-existent-category');

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it('filters canonical catalog by brand (case-insensitive)', async () => {
      const res = await request(app).get('/api/canonical-products?brand=ajazz');

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].brand).toBe('Ajazz');
    });

    it('searches against canonical name, brand, or model', async () => {
      const res = await request(app).get('/api/canonical-products?search=XG32UCWG');

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].model).toBe('XG32UCWG');
    });

    it('filters by computed bestOffer minPrice and maxPrice', async () => {
      // Ajazz bestOffer is 10,500; ASUS bestOffer is 55,000
      const res = await request(app).get('/api/canonical-products?minPrice=10000&maxPrice=11000');

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].id).toBe(ajazzCanonical._id.toString());
      expect(res.body.products[0].bestOffer.price).toBe(10500);
    });
  });

  describe('3. Sorting & Pagination', () => {
    it('sorts canonical products by computed bestOffer price ascending (price_asc)', async () => {
      const res = await request(app).get('/api/canonical-products?sort=price_asc');

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(2);
      expect(res.body.products[0].bestOffer.price).toBe(10500); // Ajazz
      expect(res.body.products[1].bestOffer.price).toBe(55000); // ASUS
    });

    it('sorts canonical products by computed bestOffer price descending (price_desc)', async () => {
      const res = await request(app).get('/api/canonical-products?sort=price_desc');

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(2);
      expect(res.body.products[0].bestOffer.price).toBe(55000); // ASUS
      expect(res.body.products[1].bestOffer.price).toBe(10500); // Ajazz
    });

    it('sorts canonical products alphabetically by name (name_asc)', async () => {
      const res = await request(app).get('/api/canonical-products?sort=name_asc');

      expect(res.status).toBe(200);
      expect(res.body.products[0].name.startsWith('Ajazz')).toBe(true);
      expect(res.body.products[1].name.startsWith('ASUS')).toBe(true);
    });

    it('paginates results deterministically', async () => {
      const page1 = await request(app).get('/api/canonical-products?page=1&limit=1&sort=price_asc');
      expect(page1.status).toBe(200);
      expect(page1.body.products.length).toBe(1);
      expect(page1.body.pagination.total).toBe(2);
      expect(page1.body.pagination.totalPages).toBe(2);
      expect(page1.body.products[0].id).toBe(ajazzCanonical._id.toString());

      const page2 = await request(app).get('/api/canonical-products?page=2&limit=1&sort=price_asc');
      expect(page2.status).toBe(200);
      expect(page2.body.products.length).toBe(1);
      expect(page2.body.products[0].id).toBe(asusCanonical._id.toString());
    });
  });

  describe('4. Input Validation & Error Handling', () => {
    it('returns 400 Bad Request for negative minPrice or maxPrice', async () => {
      const res = await request(app).get('/api/canonical-products?minPrice=-50');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('minPrice must be a non-negative number');
    });

    it('returns 400 Bad Request when minPrice exceeds maxPrice', async () => {
      const res = await request(app).get('/api/canonical-products?minPrice=5000&maxPrice=1000');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('minPrice cannot exceed maxPrice');
    });

    it('returns 400 Bad Request for invalid page or limit parameters', async () => {
      const res = await request(app).get('/api/canonical-products?page=0');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid page parameter');
    });
  });

  describe('5. Single Canonical Product Read (GET /api/canonical-products/:id)', () => {
    it('returns 400 Bad Request for malformed ObjectId', async () => {
      const res = await request(app).get('/api/canonical-products/invalid-object-id');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid canonical product ID format');
    });

    it('returns 404 Not Found for non-existent canonical product', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/canonical-products/${nonExistentId}`);
      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Canonical product not found');
    });

    it('returns 200 with sanitized canonical product and best offer summary', async () => {
      const res = await request(app).get(`/api/canonical-products/${ajazzCanonical._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.product).toBeDefined();
      expect(res.body.product.id).toBe(ajazzCanonical._id.toString());
      expect(res.body.product.name).toBe('Ajazz AK680 V2 Magnetic Switch Gaming Keyboard');
      expect(res.body.product.bestOffer).toBeDefined();
      expect(res.body.product.bestOffer.price).toBe(10500);
      expect(res.body.product.bestOffer.redirectUrl).toBe(`/api/offers/${res.body.product.bestOffer.id}/redirect`);
      expect(res.body.product.offerCount).toBe(2);
      expect(res.body.product.sellerCount).toBe(1);

      // Verify privacy / data minimization: raw affiliate URLs must never be exposed
      expect(JSON.stringify(res.body)).not.toContain('SECRET_KEY_123');
      expect(JSON.stringify(res.body)).not.toContain('https://affiliate.example.com');
    });
  });
});
