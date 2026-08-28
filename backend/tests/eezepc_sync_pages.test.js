const mongoose = require('mongoose');
const { syncPages } = require('../src/ingestion/sources/eezepc/sync');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

require('dotenv').config();

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  
  let uri = process.env.MONGODB_URI;
  if (uri) {
    if (uri.includes('?')) {
      const parts = uri.split('?');
      if (parts[0].endsWith('/')) {
        parts[0] += 'teckai_test';
      } else {
        const lastSlash = parts[0].lastIndexOf('/');
        parts[0] = parts[0].substring(0, lastSlash + 1) + 'teckai_test';
      }
      uri = parts.join('?');
    } else {
      if (uri.endsWith('/')) {
        uri += 'teckai_test';
      } else {
        const lastSlash = uri.lastIndexOf('/');
        if (lastSlash > uri.indexOf('://') + 2) {
          uri = uri.substring(0, lastSlash + 1) + 'teckai_test';
        } else {
          uri += '/teckai_test';
        }
      }
    }
    console.log('Connecting to integration test database on MongoDB Atlas...');
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  await Category.deleteMany({});
  await Product.deleteMany({});
  await mongoose.disconnect();
});

describe('EEZEPC Ingestion Multi-Page Synchronization Tests', () => {
  let fetchSpy;

  beforeEach(async () => {
    fetchSpy = jest.spyOn(global, 'fetch');
    await Product.deleteMany({});
    await Category.deleteMany({});

    // Seed target categories
    await Category.create([
      { name: 'Laptops', slug: 'laptops', isActive: true },
      { name: 'Monitors', slug: 'monitors', isActive: true },
      { name: 'Keyboards', slug: 'keyboards', isActive: true },
      { name: 'Mouse', slug: 'mouse', isActive: true },
      { name: 'Headphones', slug: 'headphones', isActive: true }
    ]);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const createRawProduct = (id, name, slug, categorySlug, price = '1000', is_in_stock = true) => {
    return {
      id,
      name,
      slug,
      sku: `SKU-${id}`,
      permalink: `https://eezepc.com/product/${slug}/`,
      description: '<p>Standard testing description.</p>',
      prices: {
        price,
        currency_code: 'PKR',
        currency_minor_unit: 0
      },
      is_in_stock,
      categories: [
        { name: categorySlug, slug: categorySlug }
      ],
      images: [
        { src: `https://eezepc.com/wp-content/uploads/${slug}.jpg` }
      ],
      attributes: []
    };
  };

  test('successfully synchronizes multiple pages and aggregates counts', async () => {
    const page1Data = [
      createRawProduct(101, 'HP Victus 15', 'hp-victus-15', 'laptops'),
      createRawProduct(102, 'Razer Mouse', 'razer-mouse', 'mouse'),
      createRawProduct(103, 'JBL Speaker', 'jbl-speaker', 'speakers') // skipped
    ];

    const page2Data = [
      createRawProduct(201, 'Dell Monitor', 'dell-monitor', 'monitors'),
      createRawProduct(202, 'Phone Charger', 'charger', 'accessories') // skipped
    ];

    // Mock fetch for page 1 and page 2
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => page1Data
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => page2Data
      });

    const summary = await syncPages({ startPage: 1, maxPages: 2, perPage: 3 });

    expect(summary.success).toBe(true);
    expect(summary.pagesRequested).toBe(2);
    expect(summary.pagesProcessed).toBe(2);
    expect(summary.fetched).toBe(5);
    expect(summary.supported).toBe(3);
    expect(summary.skipped).toBe(2);
    expect(summary.created).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.pages).toHaveLength(2);
    expect(summary.pages[0]).toEqual({
      page: 1,
      fetched: 3,
      supported: 2,
      skipped: 1,
      created: 2,
      updated: 0,
      failed: 0
    });
    expect(summary.pages[1]).toEqual({
      page: 2,
      fetched: 2,
      supported: 1,
      skipped: 1,
      created: 1,
      updated: 0,
      failed: 0
    });

    const count = await Product.countDocuments({});
    expect(count).toBe(3);
  });

  test('stops sync early if an empty page is returned', async () => {
    const page1Data = [createRawProduct(101, 'HP Victus 15', 'hp-victus-15', 'laptops')];
    const page2Data = []; // empty page -> stop condition!

    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => page1Data
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => page2Data
      });

    const summary = await syncPages({ startPage: 1, maxPages: 3, perPage: 1 });
    
    // Should process page 1 and page 2, and stop before requesting page 3
    expect(summary.pagesProcessed).toBe(2);
    expect(summary.fetched).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test('stops sync early if a short page (fewer than perPage) is returned', async () => {
    const page1Data = [
      createRawProduct(101, 'HP Victus 15', 'hp-victus-15', 'laptops'),
      createRawProduct(102, 'Razer Mouse', 'razer-mouse', 'mouse')
    ]; // 2 products returned when perPage = 3 -> short page!

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
      json: async () => page1Data
    });

    const summary = await syncPages({ startPage: 1, maxPages: 3, perPage: 3 });
    
    // Should process page 1 and stop immediately (does not attempt page 2)
    expect(summary.pagesProcessed).toBe(1);
    expect(summary.fetched).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('stops sync on API page failure and preserves already completed pages', async () => {
    const page1Data = [createRawProduct(101, 'HP Victus 15', 'hp-victus-15', 'laptops')];

    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => page1Data
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null }
      });

    const summary = await syncPages({ startPage: 1, maxPages: 3, perPage: 1 });

    // Page 1 succeeded, Page 2 failed -> halts page 3, returns completed page 1 results
    expect(summary.success).toBe(false);
    expect(summary.reason).toBe('source_unavailable');
    expect(summary.status).toBe(403);
    expect(summary.pagesProcessed).toBe(1);
    expect(summary.fetched).toBe(1);
    expect(summary.created).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toEqual({
      page: 2,
      error: 'Page fetch failed: source_unavailable'
    });

    const count = await Product.countDocuments({});
    expect(count).toBe(1);
  });

  test('deduplicates and updates product fields without duplicating on second sync run', async () => {
    const page1Data = [createRawProduct(101, 'HP Victus 15', 'hp-victus-15', 'laptops', '150000', true)];

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
      json: async () => page1Data
    });

    // Run 1
    const res1 = await syncPages({ startPage: 1, maxPages: 1, perPage: 1 });
    expect(res1.created).toBe(1);
    expect(res1.updated).toBe(0);

    const firstProduct = await Product.findOne({ 'source.listingId': '101' });
    const firstSyncTime = firstProduct.source.lastSyncedAt.getTime();

    await new Promise(resolve => setTimeout(resolve, 50));

    // Run 2 (Update price and name)
    const page1UpdateData = [createRawProduct(101, 'HP Victus 15 New Edition', 'hp-victus-15', 'laptops', '155000', false)];
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
      json: async () => page1UpdateData
    });

    const res2 = await syncPages({ startPage: 1, maxPages: 1, perPage: 1 });
    expect(res2.created).toBe(0);
    expect(res2.updated).toBe(1);

    const updatedProduct = await Product.findOne({ 'source.listingId': '101' });
    expect(updatedProduct.name).toBe('HP Victus 15 New Edition');
    expect(updatedProduct.price).toBe(155000);
    expect(updatedProduct.availability).toBe('out_of_stock');
    expect(updatedProduct.stock).toBeUndefined(); // no fabricated stock
    expect(updatedProduct.source.lastSyncedAt.getTime()).toBeGreaterThan(firstSyncTime);
  });
});
