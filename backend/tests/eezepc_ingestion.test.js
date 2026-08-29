const mongoose = require('mongoose');
const { fetchProducts, fetchProduct } = require('../src/ingestion/sources/eezepc/client');
const { mapProduct, convertPrice } = require('../src/ingestion/sources/eezepc/mapper');
const { normalizeProduct } = require('../src/ingestion/normalizeProduct');
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

describe('EEZEPC API Ingestion Connector & Mapper Tests', () => {
  let fetchSpy;

  beforeEach(async () => {
    fetchSpy = jest.spyOn(global, 'fetch');
    await Product.deleteMany({});
    await Category.deleteMany({});

    // Seed basic category mapping
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

  describe('Client Fetch Tests', () => {
    test('successful JSON response returns products list', async () => {
      const mockPayload = [{ id: 1, name: 'Product 1' }];
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
        },
        json: async () => mockPayload
      });

      const res = await fetchProducts({ page: 1, perPage: 10 });
      expect(res.success).toBe(true);
      expect(res.rawStatus).toBe(200);
      expect(res.products).toEqual(mockPayload);
    });

    test('replaces client details for specific fetchProduct call', async () => {
      const mockItem = { id: 42, name: 'Product 42' };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
        },
        json: async () => mockItem
      });

      const res = await fetchProduct(42);
      expect(res.success).toBe(true);
      expect(res.product).toEqual(mockItem);
    });

    test('invalid page or perPage throws or returns invalid_arguments error', async () => {
      const res1 = await fetchProducts({ page: 0, perPage: 10 });
      expect(res1.success).toBe(false);
      expect(res1.reason).toBe('invalid_arguments');

      const res2 = await fetchProducts({ page: 1, perPage: 150 });
      expect(res2.success).toBe(false);
      expect(res2.reason).toBe('invalid_arguments');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('invalid product ID is rejected before fetch', async () => {
      const res1 = await fetchProduct(-1);
      expect(res1.success).toBe(false);
      expect(res1.reason).toBe('invalid_arguments');

      const res2 = await fetchProduct('abc');
      expect(res2.success).toBe(false);
      expect(res2.reason).toBe('invalid_arguments');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('non-JSON response triggers unexpected_content error', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => name.toLowerCase() === 'content-type' ? 'text/html' : null
        }
      });

      const res = await fetchProducts();
      expect(res.success).toBe(false);
      expect(res.reason).toBe('unexpected_content');
      expect(res.status).toBe(200);
    });

    test('HTTP error responses return source_unavailable error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 403,
        headers: {
          get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null
        }
      });

      const res = await fetchProducts();
      expect(res.success).toBe(false);
      expect(res.reason).toBe('source_unavailable');
      expect(res.status).toBe(403);
    });

    test('timeout or network failure return distinct abort errors', async () => {
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValue(abortError);

      const res1 = await fetchProducts();
      expect(res1.success).toBe(false);
      expect(res1.reason).toBe('timeout');
      expect(res1.status).toBeUndefined();

      fetchSpy.mockRejectedValue(new Error('TypeError: fetch failed'));
      const res2 = await fetchProducts();
      expect(res2.success).toBe(false);
      expect(res2.reason).toBe('network_error');
      expect(res2.status).toBeUndefined();
    });
  });

  describe('Mapper & Ingestion Logic Tests', () => {
    const createRawItem = (overrides = {}) => {
      return {
        id: 12345,
        name: 'HP EliteBook 840 G8',
        slug: 'hp-elitebook-840-g8',
        sku: 'HP-EB-840-G8',
        permalink: 'https://eezepc.com/product/hp-elitebook-840-g8/',
        description: '<p>A premium thin laptop with solid performance.</p>',
        prices: {
          price: '245000',
          currency_code: 'PKR',
          currency_minor_unit: 0
        },
        is_in_stock: true,
        categories: [
          { name: 'Laptops', slug: 'laptops' }
        ],
        images: [
          { src: 'https://eezepc.com/wp-content/uploads/laptop.jpg' }
        ],
        attributes: [
          { name: 'RAM', terms: [{ name: '16GB' }] },
          { name: 'Storage', terms: [{ name: '512GB SSD' }] }
        ],
        ...overrides
      };
    };

    test('maps raw EEZEPC product attributes correctly to generic representation', () => {
      const raw = createRawItem();
      const mapped = mapProduct(raw);

      expect(mapped.source.listingId).toBe('12345');
      expect(mapped.source.name).toBe('EEZEPC');
      expect(mapped.source.url).toBe('https://eezepc.com/product/hp-elitebook-840-g8/');
      expect(mapped.sku).toBe('HP-EB-840-G8');
      expect(mapped.slug).toBe('hp-elitebook-840-g8');
      expect(mapped.name).toBe('HP EliteBook 840 G8');
      expect(mapped.description).toBe('A premium thin laptop with solid performance.');
      expect(mapped.price).toBe(245000);
      expect(mapped.currency).toBe('PKR');
      expect(mapped.images).toEqual(['https://eezepc.com/wp-content/uploads/laptop.jpg']);
      expect(mapped.availability).toBe('in_stock');
      expect(mapped.stock).toBeUndefined(); // no fabricated stock
      expect(mapped.specifications).toEqual({
        ram: '16GB',
        storage: '512GB SSD'
      });
      expect(mapped.condition).toBe('new');
    });

    test('price conversion division handles minor units safely to prevent 100x/0.01x shifts', () => {
      // 0 minor units (PKR default)
      expect(convertPrice({ price: '150000', currency_minor_unit: 0 })).toBe(150000);
      
      // 2 minor units (standard fallback)
      expect(convertPrice({ price: '150000', currency_minor_unit: 2 })).toBe(1500);

      // 3 minor units
      expect(convertPrice({ price: '150000', currency_minor_unit: 3 })).toBe(150);

      // Reject non-numeric prices
      expect(() => convertPrice({ price: 'abc', currency_minor_unit: 0 })).toThrow('prices.price is not a numeric value');
      
      // Reject negative minor units
      expect(() => convertPrice({ price: '1000', currency_minor_unit: -1 })).toThrow('prices.currency_minor_unit must be a non-negative integer');
      
      // Reject non-integer minor units
      expect(() => convertPrice({ price: '1000', currency_minor_unit: 1.5 })).toThrow('prices.currency_minor_unit must be a non-negative integer');
    });

    test('decodes HTML entities and strips harmful markup in plain text mapping', () => {
      const raw = createRawItem({
        name: 'HP EliteBook &#8211; G8 &amp; Accessories',
        description: '<p>Standard Thin Laptop.</p><script>alert("hack")</script><style>body {color: red}</style><ul><li>Fast</li></ul>'
      });

      const mapped = mapProduct(raw);
      expect(mapped.name).toBe('HP EliteBook – G8 & Accessories');
      expect(mapped.description).toBe('Standard Thin Laptop.Fast');
      expect(mapped.description).not.toContain('<p>');
      expect(mapped.description).not.toContain('<script>');
      expect(mapped.description).not.toContain('alert');
    });

    test('resolves and filters all five category slugs', () => {
      // 1. Laptops
      const m1 = mapProduct(createRawItem({ categories: [{ slug: 'laptops-notebooks', name: 'Notebooks' }] }));
      expect(m1.category).toBe('laptops');

      // 2. Monitors
      const m2 = mapProduct(createRawItem({ categories: [{ slug: 'lcd-monitors', name: 'Gaming Monitors' }] }));
      expect(m2.category).toBe('monitors');

      // 3. Keyboards
      const m3 = mapProduct(createRawItem({ categories: [{ slug: 'gaming-keyboards', name: 'Keyboards' }] }));
      expect(m3.category).toBe('keyboards');

      // 4. Mouse
      const m4 = mapProduct(createRawItem({ categories: [{ slug: 'mice-mouse', name: 'Gaming Mouse' }] }));
      expect(m4.category).toBe('mouse');

      // 5. Headphones
      const m5 = mapProduct(createRawItem({ categories: [{ slug: 'gaming-headphones', name: 'Headsets' }] }));
      expect(m5.category).toBe('headphones');
    });

    test('rejects/skips unsupported categories', () => {
      const rawUnsupported = createRawItem({
        categories: [{ name: 'Graphics Cards', slug: 'gpus' }]
      });

      expect(() => mapProduct(rawUnsupported)).toThrow('Product does not belong to any supported TeckAI category');
    });

    test('rejects mapping if raw product ID is missing', () => {
      const rawNoId = createRawItem({ id: null });
      expect(() => mapProduct(rawNoId)).toThrow('EEZEPC product ID is required for mapping identity');
    });

    test('end-to-end mapper -> normalizeProduct matches schema rules', () => {
      const raw = createRawItem({
        is_in_stock: false
      });
      const mapped = mapProduct(raw);
      const normalized = normalizeProduct(mapped);

      expect(normalized.source.name).toBe('EEZEPC');
      expect(normalized.source.listingId).toBe('12345');
      expect(normalized.name).toBe('HP EliteBook 840 G8');
      expect(normalized.price).toBe(245000);
      expect(normalized.currency).toBe('PKR');
      expect(normalized.condition).toBe('new');
      expect(normalized.availability).toBe('out_of_stock');
      expect(normalized.stock).toBeUndefined();
      expect(normalized.images).toEqual(['https://eezepc.com/wp-content/uploads/laptop.jpg']);
      expect(normalized.specifications).toEqual({
        ram: '16GB',
        storage: '512GB SSD'
      });
    });

    describe('Brand Extraction Regression Tests', () => {
      test('ASUS monitor + category Monitors resolves to ASUS, brand never becomes Monitors', () => {
        const raw = createRawItem({
          name: 'ASUS ROG Strix XG32UCWG Gaming Monitor',
          attributes: [
            { name: 'Brand', terms: [{ name: 'ASUS' }] }
          ],
          categories: [
            { id: 32, name: 'Monitors', slug: 'gaming-monitors' }
          ]
        });
        const mapped = mapProduct(raw);
        expect(mapped.brand).toBe('ASUS');
      });

      test('explicit Brand attribute = ASUS resolves brand to ASUS', () => {
        const raw = createRawItem({
          attributes: [
            { name: 'Brand', terms: [{ name: 'ASUS' }] }
          ],
          categories: [
            { id: 32, name: 'Monitors', slug: 'gaming-monitors' }
          ]
        });
        const mapped = mapProduct(raw);
        expect(mapped.brand).toBe('ASUS');
      });

      test('no explicit trustworthy brand leaves brand undefined/omitted', () => {
        const raw = createRawItem({
          categories: [
            { id: 32, name: 'Monitors', slug: 'gaming-monitors' }
          ]
        });
        const mapped = mapProduct(raw);
        expect(mapped.brand).toBeUndefined();
      });

      test('EWEADN keyboard with brand attribute resolves to EWEADN', () => {
        const raw = createRawItem({
          name: 'EWEADN DK63 Keyboard',
          attributes: [
            { name: 'Brand', terms: [{ name: 'EWEADN' }] }
          ],
          categories: [
            { id: 58, name: 'Keyboards', slug: 'keyboards' }
          ]
        });
        const mapped = mapProduct(raw);
        expect(mapped.brand).toBe('EWEADN');
      });
    });

    describe('Category Mapping & Accessory Filtering Regression Tests', () => {
      test('Gaming Mouse and Wireless Mouse map to mouse', () => {
        const m1 = mapProduct(createRawItem({ categories: [{ slug: 'gaming-mouse', name: 'Gaming Mouse' }] }));
        expect(m1.category).toBe('mouse');

        const m2 = mapProduct(createRawItem({ categories: [{ slug: 'wireless-mouse', name: 'Wireless Mouse' }] }));
        expect(m2.category).toBe('mouse');
      });

      test('Mouse Pad, Mouse Mat, Mouse Accessories, and Mouse Bungee are unsupported', () => {
        expect(() => mapProduct(createRawItem({ categories: [{ slug: 'mouse-pad', name: 'Mouse Pad' }] })))
          .toThrow('Product does not belong to any supported TeckAI category');

        expect(() => mapProduct(createRawItem({ categories: [{ slug: 'mouse-pads', name: 'Mouse Pads' }] })))
          .toThrow('Product does not belong to any supported TeckAI category');

        expect(() => mapProduct(createRawItem({ categories: [{ slug: 'mouse-mat', name: 'Mouse Mat' }] })))
          .toThrow('Product does not belong to any supported TeckAI category');

        expect(() => mapProduct(createRawItem({ categories: [{ slug: 'mouse-accessories', name: 'Mouse Accessories' }] })))
          .toThrow('Product does not belong to any supported TeckAI category');

        expect(() => mapProduct(createRawItem({ categories: [{ slug: 'mouse-bungee', name: 'Mouse Bungee' }] })))
          .toThrow('Product does not belong to any supported TeckAI category');
      });

      test('Gaming Keyboard maps to keyboards; Keyboard Accessories and Keycaps are unsupported', () => {
        const k1 = mapProduct(createRawItem({ categories: [{ slug: 'gaming-keyboards', name: 'Gaming Keyboard' }] }));
        expect(k1.category).toBe('keyboards');

        expect(() => mapProduct(createRawItem({ categories: [{ slug: 'keyboard-accessories', name: 'Keyboard Accessories' }] })))
          .toThrow('Product does not belong to any supported TeckAI category');

        expect(() => mapProduct(createRawItem({ categories: [{ slug: 'keycaps', name: 'Keycaps' }] })))
          .toThrow('Product does not belong to any supported TeckAI category');
      });

      test('Headphones/Headsets map to headphones; headphone accessories and cases are unsupported', () => {
        const h1 = mapProduct(createRawItem({ categories: [{ slug: 'gaming-headsets', name: 'Headphones/Headsets' }] }));
        expect(h1.category).toBe('headphones');

        expect(() => mapProduct(createRawItem({ categories: [{ slug: 'headphone-accessories', name: 'Headphone Accessories' }] })))
          .toThrow('Product does not belong to any supported TeckAI category');

        expect(() => mapProduct(createRawItem({ categories: [{ slug: 'headphone-cases', name: 'Headphone Cases' }] })))
          .toThrow('Product does not belong to any supported TeckAI category');

        expect(() => mapProduct(createRawItem({ categories: [{ slug: 'headphone-stands', name: 'Headphone Stand' }] })))
          .toThrow('Product does not belong to any supported TeckAI category');
      });
    });
  });
});
