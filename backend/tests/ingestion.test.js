const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const { normalizeProduct } = require('../src/ingestion/normalizeProduct');

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

      expect(p1._id).toBeDefined();
      expect(p2._id).toBeDefined();
    });
  });
});
