const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const { normalizeProduct } = require('../src/ingestion/normalizeProduct');
const { upsertProduct } = require('../src/ingestion/upsertProduct');
const { ingestProducts } = require('../src/ingestion/ingestProducts');

require('dotenv').config();
let mongoServer;

jest.setTimeout(120000); // Allow download of MongoDB binary in tests

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
  } else {
    console.log('No MONGODB_URI env variable found. Attempting MongoMemoryServer...');
    mongoServer = await MongoMemoryServer.create();
    const memUri = mongoServer.getUri();
    await mongoose.connect(memUri);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

let testCategory;

beforeEach(async () => {
  // Clear collections and re-create indexes
  await Category.deleteMany({});
  await Product.deleteMany({});
  await Product.syncIndexes();

  testCategory = await Category.create({
    name: 'Laptops',
    slug: 'laptops',
    description: 'Workstations'
  });

  await Category.create({
    name: 'Headphones',
    slug: 'headphones',
    description: 'Audio'
  });

  await Category.create({
    name: 'Keyboards',
    slug: 'keyboards',
    description: 'Input devices'
  });

  await Category.create({
    name: 'Monitors',
    slug: 'monitors',
    description: 'Displays'
  });

  await Category.create({
    name: 'Mouse',
    slug: 'mouse',
    description: 'Pointing devices'
  });
});

describe('Product Ingestion - Step 1 Tests', () => {
  
  // 1. normalizeProduct function tests
  describe('normalizeProduct() Utility', () => {
    
    test('should normalize a standard product correctly', () => {
      const raw = {
        name: '  HP EliteBook 840  ',
        price: '165000',
        brand: 'HP',
        category: testCategory._id,
        description: 'Business laptop',
        stock: 5,
        slug: 'hp-elitebook-840',
        sku: 'HP-EB840'
      };

      const normalized = normalizeProduct(raw);

      expect(normalized.name).toBe('HP EliteBook 840');
      expect(normalized.price).toBe(165000);
      expect(normalized.condition).toBe('new');
      expect(normalized.currency).toBe('PKR');
      expect(normalized.images).toEqual([]);
      expect(normalized.specifications).toEqual({});
    });

    test('should trim all string fields', () => {
      const raw = {
        name: '   Device   ',
        price: 500,
        brand: '   Brand   ',
        description: '   Desc   ',
        sku: '   SKU-1   ',
        slug: '   slug-1   ',
        currency: '   USD   '
      };

      const normalized = normalizeProduct(raw);
      expect(normalized.name).toBe('Device');
      expect(normalized.brand).toBe('Brand');
      expect(normalized.description).toBe('Desc');
      expect(normalized.sku).toBe('SKU-1');
      expect(normalized.slug).toBe('slug-1');
      expect(normalized.currency).toBe('USD');
    });

    test('should accept used and refurbished conditions', () => {
      const usedRaw = { name: 'Device A', price: 100, condition: 'used' };
      const refRaw = { name: 'Device B', price: 150, condition: 'Refurbished' };

      expect(normalizeProduct(usedRaw).condition).toBe('used');
      expect(normalizeProduct(refRaw).condition).toBe('refurbished');
    });

    test('should throw validation error for missing name', () => {
      expect(() => normalizeProduct({ price: 100 })).toThrow('Product name is required');
      expect(() => normalizeProduct({ name: '   ', price: 100 })).toThrow('Product name is required');
    });

    test('should throw validation error for invalid price', () => {
      expect(() => normalizeProduct({ name: 'Dev', price: 'abc' })).toThrow('Product price must be a valid number');
      expect(() => normalizeProduct({ name: 'Dev', price: -5 })).toThrow('Product price cannot be negative');
    });

    test('should throw validation error for unsupported condition', () => {
      expect(() => normalizeProduct({ name: 'Dev', price: 10, condition: 'damaged' })).toThrow('Unsupported condition');
    });

    test('should normalize source url and throw if invalid or using non-http/https protocol', () => {
      const validUrlRaw = {
        name: 'Dev',
        price: 10,
        source: {
          name: 'Daraz',
          listingId: '123',
          url: 'https://www.daraz.pk/products/123'
        }
      };
      
      const normalized = normalizeProduct(validUrlRaw);
      expect(normalized.source.url).toBe('https://www.daraz.pk/products/123');

      const ftpUrlRaw = {
        name: 'Dev',
        price: 10,
        source: { url: 'ftp://files.example.com/item' }
      };
      expect(() => normalizeProduct(ftpUrlRaw)).toThrow('URL must use http or https protocol');

      const malformedUrlRaw = {
        name: 'Dev',
        price: 10,
        source: { url: 'not-a-url' }
      };
      expect(() => normalizeProduct(malformedUrlRaw)).toThrow('Invalid source URL');
    });

    test('should omit empty/blank optional source and seller fields', () => {
      const raw = {
        name: 'Dev',
        price: 10,
        source: {
          name: '   ',
          listingId: '',
          url: '   '
        },
        seller: {
          name: '',
          location: '   '
        }
      };

      const normalized = normalizeProduct(raw);
      expect(normalized.source).toBeUndefined();
      expect(normalized.seller).toBeUndefined();
    });
  });

  // 2. Mongoose Product validation & compatibility tests
  describe('Product Mongoose Model Validation & Compatibility', () => {
    
    test('existing manual products without source or seller metadata must be valid and default to condition: new', async () => {
      const manualProduct = await Product.create({
        name: 'Manual Laptop',
        slug: 'manual-laptop',
        sku: 'MAN-L1',
        description: 'Classic manual product description',
        price: 99000,
        stock: 10,
        category: testCategory._id,
        brand: 'DefaultBrand'
      });

      expect(manualProduct.condition).toBe('new');
      expect(manualProduct.toObject().source).toBeUndefined();
      expect(manualProduct.toObject().seller).toBeUndefined();
    });

    test('multiple manual products without source identity can coexist without unique index conflict', async () => {
      const p1 = await Product.create({
        name: 'Laptop A',
        slug: 'laptop-a',
        sku: 'SKU-A',
        description: 'Description A',
        price: 50000,
        stock: 5,
        category: testCategory._id,
        brand: 'BrandA'
      });

      const p2 = await Product.create({
        name: 'Laptop B',
        slug: 'laptop-b',
        sku: 'SKU-B',
        description: 'Description B',
        price: 60000,
        stock: 8,
        category: testCategory._id,
        brand: 'BrandB'
      });

      expect(p1._id).toBeDefined();
      expect(p2._id).toBeDefined();
    });

    test('blank or empty source identity strings must be converted to undefined and not indexed as empty strings', async () => {
      const p1 = await Product.create({
        name: 'Laptop C',
        slug: 'laptop-c',
        sku: 'SKU-C',
        description: 'Description C',
        price: 50000,
        stock: 5,
        category: testCategory._id,
        brand: 'BrandC',
        source: {
          name: '',
          listingId: ''
        }
      });

      const p2 = await Product.create({
        name: 'Laptop D',
        slug: 'laptop-d',
        sku: 'SKU-D',
        description: 'Description D',
        price: 60000,
        stock: 8,
        category: testCategory._id,
        brand: 'BrandD',
        source: {
          name: '   ',
          listingId: '   '
        }
      });

      expect(p1.toObject().source).toBeUndefined();
      expect(p2.toObject().source).toBeUndefined();
    });

    test('duplicate external listing with same source.name + source.listingId must be rejected / prevented', async () => {
      await Product.create({
        name: 'External Laptop 1',
        slug: 'ext-laptop-1',
        sku: 'EXT-L1',
        description: 'Ext desc 1',
        price: 120000,
        stock: 5,
        category: testCategory._id,
        brand: 'BrandA',
        source: {
          name: 'Daraz',
          listingId: 'DARAZ-1001',
          type: 'scraper'
        }
      });

      // Try creating another product with the same source.name and source.listingId
      await expect(
        Product.create({
          name: 'External Laptop 2',
          slug: 'ext-laptop-2',
          sku: 'EXT-L2',
          description: 'Ext desc 2',
          price: 125000,
          stock: 3,
          category: testCategory._id,
          brand: 'BrandB',
          source: {
            name: 'Daraz',
            listingId: 'DARAZ-1001',
            type: 'scraper'
          }
        })
      ).rejects.toThrow();
    });

    test('same listingId from different sources is allowed', async () => {
      const p1 = await Product.create({
        name: 'Laptop X',
        slug: 'laptop-x',
        sku: 'SKU-X',
        description: 'Description X',
        price: 50000,
        stock: 5,
        category: testCategory._id,
        brand: 'Brand',
        source: {
          name: 'Daraz',
          listingId: 'ID-999'
        }
      });

      const p2 = await Product.create({
        name: 'Laptop Y',
        slug: 'laptop-y',
        sku: 'SKU-Y',
        description: 'Description Y',
        price: 60000,
        stock: 8,
        category: testCategory._id,
        brand: 'Brand',
        source: {
          name: 'OLX',
          listingId: 'ID-999'
        }
      });

    });
  });

  // 3. Step 2B: upsertProduct and ingestProducts tests
  describe('upsertProduct() & ingestProducts() persistence layer', () => {

    test('first external listing creates a product and populates lastSyncedAt', async () => {
      const normalized = {
        name: 'HP EliteBook 840',
        price: 150000,
        brand: 'HP',
        category: 'laptops',
        condition: 'new',
        description: 'Elite laptop',
        source: {
          name: 'Daraz',
          listingId: '111',
          type: 'scraper'
        }
      };

      const result = await upsertProduct(normalized);
      expect(result.operation).toBe('created');
      expect(result.product._id).toBeDefined();
      expect(result.product.name).toBe('HP EliteBook 840');
      expect(result.product.slug).toBe('hp-elitebook-840');
      expect(result.product.sku).toBeDefined();
      expect(result.product.source.lastSyncedAt).toBeInstanceOf(Date);
    });

    test('same source.name + listingId updates instead of duplicating, preserves other fields, and refreshes lastSyncedAt', async () => {
      const firstNormalized = {
        name: 'Keyboard K552',
        price: 9000,
        brand: 'Redragon',
        category: 'keyboards',
        condition: 'new',
        description: 'Mechanical keyboard',
        source: {
          name: 'OLX',
          listingId: '222',
          type: 'scraper'
        },
        stock: 5
      };

      const r1 = await upsertProduct(firstNormalized);
      const initialId = r1.product._id;
      const initialSyncedAt = r1.product.source.lastSyncedAt;

      // Wait 10ms to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const secondNormalized = {
        name: 'Keyboard K552 V2',
        price: 9500, // updated price
        category: 'keyboards',
        source: {
          name: 'OLX',
          listingId: '222'
        }
        // stock, brand, condition, description are missing (undefined) here
      };

      const r2 = await upsertProduct(secondNormalized);
      expect(r2.operation).toBe('updated');
      expect(r2.product._id.toString()).toBe(initialId.toString());
      expect(r2.product.name).toBe('Keyboard K552 V2');
      expect(r2.product.price).toBe(9500);
      
      // Verify undefined fields on updates do not erase existing values
      expect(r2.product.brand).toBe('Redragon');
      expect(r2.product.stock).toBe(5);
      
      // Verify lastSyncedAt is refreshed
      expect(r2.product.source.lastSyncedAt.getTime()).toBeGreaterThan(initialSyncedAt.getTime());
    });

    test('same listingId from two different sources creates two separate products', async () => {
      const p1 = await upsertProduct({
        name: 'Product A',
        price: 100,
        brand: 'BrandX',
        description: 'Description X',
        category: 'headphones',
        source: { name: 'Daraz', listingId: 'ABC-777' }
      });

      const p2 = await upsertProduct({
        name: 'Product B',
        price: 120,
        brand: 'BrandY',
        description: 'Description Y',
        category: 'headphones',
        source: { name: 'OLX', listingId: 'ABC-777' }
      });

      expect(p1.operation).toBe('created');
      expect(p2.operation).toBe('created');
      expect(p1.product._id.toString()).not.toBe(p2.product._id.toString());
    });

    test('external upsert without source identity is rejected', async () => {
      await expect(
        upsertProduct({
          name: 'No Source Product',
          price: 50,
          brand: 'Brand',
          description: 'Desc',
          category: 'mouse'
        })
      ).rejects.toThrow('source.name and source.listingId are required');

      await expect(
        upsertProduct({
          name: 'No ListingId Product',
          price: 50,
          brand: 'Brand',
          description: 'Desc',
          category: 'mouse',
          source: { name: 'Daraz' }
        })
      ).rejects.toThrow('source.name and source.listingId are required');
    });

    test('valid 0 values are preserved and not ignored as missing', async () => {
      const initial = await upsertProduct({
        name: 'Device Zero',
        price: 100,
        brand: 'Brand',
        description: 'Description',
        category: 'mouse',
        stock: 10,
        source: { name: 'Daraz', listingId: 'ZERO-1' }
      });

      expect(initial.product.stock).toBe(10);

      const update = await upsertProduct({
        name: 'Device Zero',
        price: 100,
        brand: 'Brand',
        description: 'Description',
        category: 'mouse',
        stock: 0, // intentional zero
        source: { name: 'Daraz', listingId: 'ZERO-1' }
      });

      expect(update.product.stock).toBe(0);
    });

    test('valid category resolves correctly by name or slug, and unknown category is rejected', async () => {
      // 1. Resolve by slug
      const p1 = await upsertProduct({
        name: 'Laptop X',
        price: 200,
        brand: 'Brand',
        description: 'Description',
        category: 'laptops',
        source: { name: 'Daraz', listingId: 'CAT-1' }
      });
      expect(p1.product.category.toString()).toBe(testCategory._id.toString());

      // 2. Resolve by case-insensitive name
      const p2 = await upsertProduct({
        name: 'Laptop Y',
        price: 200,
        brand: 'Brand',
        description: 'Description',
        category: '  Laptops  ',
        source: { name: 'Daraz', listingId: 'CAT-2' }
      });
      expect(p2.product.category.toString()).toBe(testCategory._id.toString());

      // 3. Reject unknown category
      await expect(
        upsertProduct({
          name: 'Bad Category Product',
          price: 200,
          brand: 'Brand',
          description: 'Description',
          category: 'unknown-category-xyz',
          source: { name: 'Daraz', listingId: 'CAT-3' }
        })
      ).rejects.toThrow('Category cannot be resolved');
    });

    test('ingestProducts batch helper continues after one invalid record and reports summary correctly', async () => {
      const rawBatch = [
        {
          name: 'Valid Product 1',
          price: 1000,
          brand: 'Brand1',
          description: 'Description 1',
          category: 'laptops',
          source: { name: 'Daraz', listingId: 'BATCH-1' }
        },
        {
          // Invalid product: missing price
          name: 'Invalid Product 2',
          brand: 'Brand2',
          description: 'Description 2',
          category: 'laptops',
          source: { name: 'Daraz', listingId: 'BATCH-2' }
        },
        {
          name: 'Valid Product 3',
          price: 2000,
          brand: 'Brand3',
          description: 'Description 3',
          category: 'laptops',
          source: { name: 'Daraz', listingId: 'BATCH-3' }
        }
      ];

      const summary = await ingestProducts(rawBatch);

      expect(summary.total).toBe(3);
      expect(summary.created).toBe(2);
      expect(summary.updated).toBe(0);
      expect(summary.failed).toBe(1);
      expect(summary.errors.length).toBe(1);
      expect(summary.errors[0].index).toBe(1);
      expect(summary.errors[0].error).toContain('price is required');

      // Test batch updates
      const updateBatch = [
        {
          name: 'Valid Product 1 Updated',
          price: 1200,
          brand: 'Brand1',
          description: 'Description 1',
          category: 'laptops',
          source: { name: 'Daraz', listingId: 'BATCH-1' }
        }
      ];

      const updateSummary = await ingestProducts(updateBatch);
      expect(updateSummary.total).toBe(1);
      expect(updateSummary.created).toBe(0);
      expect(updateSummary.updated).toBe(1);
      expect(updateSummary.failed).toBe(0);
    });
  });
});
