const mongoose = require('mongoose');
const { syncProducts } = require('../src/ingestion/sources/eezepc/sync');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

const { connectTestDB, disconnectTestDB } = require('./setup/testDb');

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await Category.deleteMany({});
  await Product.deleteMany({});
  await disconnectTestDB();
});

describe('EEZEPC Ingestion Synchronization Service Tests', () => {
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

  const createRawProduct = (id, name, slug, categorySlug, price = '150000', is_in_stock = true) => {
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

  test('successfully synchronizes supported products to MongoDB', async () => {
    const rawList = [
      createRawProduct(111, 'HP Victus 15', 'hp-victus-15', 'laptops'),
      createRawProduct(222, 'Razer Viper Mouse', 'razer-viper', 'mouse')
    ];

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
      json: async () => rawList
    });

    const summary = await syncProducts({ page: 1, perPage: 10 });
    expect(summary.success).toBe(true);
    expect(summary.fetched).toBe(2);
    expect(summary.supported).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(summary.created).toBe(2);
    expect(summary.updated).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.errors).toHaveLength(0);

    const saved = await Product.find({});
    expect(saved).toHaveLength(2);

    const hp = saved.find(p => p.source.listingId === '111');
    expect(hp.name).toBe('HP Victus 15');
    expect(hp.price).toBe(150000);
    expect(hp.category.toString()).toBeDefined();
    expect(hp.source.lastSyncedAt).toBeDefined();
    expect(hp.stock).toBeUndefined(); // no fabricated stock
  });

  test('updates existing product instead of creating duplicates on re-sync', async () => {
    const rawList1 = [createRawProduct(111, 'HP Victus 15', 'hp-victus-15', 'laptops', '150000', true)];

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
      json: async () => rawList1
    });

    // First Sync (Create)
    const res1 = await syncProducts({ page: 1, perPage: 1 });
    expect(res1.created).toBe(1);

    const firstProduct = await Product.findOne({ 'source.listingId': '111' });
    const firstSyncTime = firstProduct.source.lastSyncedAt.getTime();

    // Wait a brief moment to ensure timestamp moves forward
    await new Promise(resolve => setTimeout(resolve, 50));

    // Update payload with new price/availability for re-sync
    const rawList2 = [createRawProduct(111, 'HP Victus 15 New Edition', 'hp-victus-15', 'laptops', '155000', false)];
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
      json: async () => rawList2
    });

    // Second Sync (Update)
    const res2 = await syncProducts({ page: 1, perPage: 1 });
    expect(res2.created).toBe(0);
    expect(res2.updated).toBe(1);

    const updatedProduct = await Product.findOne({ 'source.listingId': '111' });
    expect(updatedProduct.name).toBe('HP Victus 15 New Edition');
    expect(updatedProduct.price).toBe(155000);
    expect(updatedProduct.availability).toBe('out_of_stock');
    expect(updatedProduct.source.lastSyncedAt.getTime()).toBeGreaterThan(firstSyncTime);
  });

  test('skips products outside supported categories (counts as skipped, not failed)', async () => {
    const rawList = [
      createRawProduct(111, 'JBL Speaker', 'jbl-speaker', 'speakers'), // unsupported
      createRawProduct(222, 'Nvidia RTX 4070', 'nvidia-rtx-4070', 'gpus'), // unsupported
      createRawProduct(333, 'Razer Viper Mouse', 'razer-viper', 'mouse') // supported
    ];

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
      json: async () => rawList
    });

    const summary = await syncProducts({ page: 1, perPage: 10 });
    expect(summary.success).toBe(true);
    expect(summary.fetched).toBe(3);
    expect(summary.supported).toBe(1);
    expect(summary.skipped).toBe(2);
    expect(summary.created).toBe(1);
    expect(summary.failed).toBe(0);

    const saved = await Product.find({});
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Razer Viper Mouse');
  });

  test('malformed product in batch does not crash sync (continues processing others)', async () => {
    const rawList = [
      createRawProduct(111, 'HP Victus 15', 'hp-victus-15', 'laptops'), // valid
      createRawProduct(222, 'Bad Price Product', 'bad-price', 'mouse', 'not-a-number'), // malformed price
      createRawProduct(333, 'Razer Viper Mouse', 'razer-viper', 'mouse') // valid
    ];

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
      },
      json: async () => rawList
    });

    const summary = await syncProducts({ page: 1, perPage: 10 });
    expect(summary.success).toBe(true);
    expect(summary.fetched).toBe(3);
    expect(summary.supported).toBe(2); // Validates and maps the 2 good ones
    expect(summary.skipped).toBe(0);
    expect(summary.created).toBe(2);
    expect(summary.failed).toBe(1); // Mapped fails price mapping conversion
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toEqual({
      index: 1,
      listingId: '222',
      error: expect.stringContaining('prices.price is not a numeric value')
    });

    const saved = await Product.find({});
    expect(saved).toHaveLength(2);
  });

  test('safely handles client/network fetch failures', async () => {
    fetchSpy.mockRejectedValue(new Error('TypeError: fetch failed'));

    const summary = await syncProducts({ page: 1, perPage: 10 });
    expect(summary.success).toBe(false);
    expect(summary.reason).toBe('network_error');
    expect(summary.fetched).toBe(0);
    expect(summary.created).toBe(0);
    expect(summary.errors[0].error).toContain('Fetch failed');
  });
});
