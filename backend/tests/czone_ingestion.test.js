const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const { parseProductHtml } = require('../src/ingestion/sources/czone/parser');
const { mapProduct, mapCategory } = require('../src/ingestion/sources/czone/mapper');
const { normalizeProduct } = require('../src/ingestion/normalizeProduct');
const { upsertProduct } = require('../src/ingestion/upsertProduct');

require('dotenv').config();
let mongoServer;

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
  await Category.deleteMany({});
  await Product.deleteMany({});
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Czone Connector Parser, Mapper, and Ingestion Tests', () => {
  const readFixture = (name) => {
    return fs.readFileSync(path.join(__dirname, '../src/ingestion/sources/czone/fixtures', name), 'utf8');
  };

  beforeEach(async () => {
    // Clean categories and products before each test
    await Category.deleteMany({});
    await Product.deleteMany({});

    // Seed categories
    await Category.create([
      { name: 'Laptops', slug: 'laptops', isActive: true },
      { name: 'Monitors', slug: 'monitors', isActive: true },
      { name: 'Keyboards', slug: 'keyboards', isActive: true },
      { name: 'Mouse', slug: 'mouse', isActive: true },
      { name: 'Headphones', slug: 'headphones', isActive: true }
    ]);
  });

  describe('Parser Tests', () => {
    test('parser extracts title, product code, price, availability, image, features from laptop fixture', () => {
      const html = readFixture('laptop.html');
      const parsed = parseProductHtml(html, 'https://www.czone.com.pk/laptops-hp-victus-15.html');

      expect(parsed.title).toBe('HP Victus 15 Gaming Laptop');
      expect(parsed.productCode).toBe('HP-VIC-15');
      expect(parsed.priceText).toBe('Rs. 195,000');
      expect(parsed.availability).toBe('In Stock');
      expect(parsed.brandRaw).toBe('HP');
      expect(parsed.imageUrl).toBe('https://example.com/hp-victus.jpg');
      expect(parsed.features).toEqual({
        Processor: 'Intel Core i5-12500H',
        RAM: '8GB DDR4'
      });
      expect(parsed.url).toBe('https://www.czone.com.pk/laptops-hp-victus-15.html');
    });

    test('parser extracts out of stock status from out_of_stock fixture', () => {
      const html = readFixture('out_of_stock.html');
      const parsed = parseProductHtml(html);

      expect(parsed.availability).toBe('Out Of Stock');
      expect(parsed.title).toBe('Out of Stock Item');
      expect(parsed.productCode).toBe('OOS-ITEM');
    });

    test('parser handles malformed html gracefully', () => {
      const html = readFixture('malformed.html');
      const parsed = parseProductHtml(html);

      expect(parsed.title).toBe('');
      expect(parsed.productCode).toBe('');
      expect(parsed.priceText).toBe('');
    });
  });

  describe('Mapper Tests', () => {
    test('category mapping resolves all five category aliases correctly', () => {
      // 1. Laptops
      expect(mapCategory('Laptops')).toBe('laptops');
      expect(mapCategory('Notebooks')).toBe('laptops');
      expect(mapCategory('Gaming Laptops')).toBe('laptops');

      // 2. Monitors
      expect(mapCategory('Monitors')).toBe('monitors');
      expect(mapCategory('LED Monitors')).toBe('monitors');
      expect(mapCategory('Gaming Monitors')).toBe('monitors');

      // 3. Keyboards
      expect(mapCategory('Keyboards')).toBe('keyboards');
      expect(mapCategory('Gaming Keyboards')).toBe('keyboards');

      // 4. Mouse
      expect(mapCategory('Mouse')).toBe('mouse');
      expect(mapCategory('Mice')).toBe('mouse');
      expect(mapCategory('Gaming Mouse')).toBe('mouse');

      // 5. Headphones
      expect(mapCategory('Headphones')).toBe('headphones');
      expect(mapCategory('Headsets')).toBe('headphones');
      expect(mapCategory('Gaming Headphones')).toBe('headphones');

      // Unknown
      expect(mapCategory('Random Unknown Category')).toBeUndefined();
    });

    test('maps raw parsed Czone object to normalized generic input', () => {
      const rawCzone = {
        productCode: 'HP-VIC-15',
        title: 'HP Victus 15 Gaming Laptop',
        brandRaw: 'HP',
        priceText: 'Rs. 195,000',
        url: 'https://example.com/hp-victus',
        categoryRaw: 'Laptops',
        imageUrl: 'https://example.com/img.jpg',
        features: { Processor: 'i5' },
        availability: 'In Stock'
      };

      const mapped = mapProduct(rawCzone);

      expect(mapped.name).toBe('HP Victus 15 Gaming Laptop');
      expect(mapped.price).toBe(195000);
      expect(mapped.currency).toBe('PKR');
      expect(mapped.brand).toBe('HP');
      expect(mapped.category).toBe('laptops');
      expect(mapped.condition).toBe('new');
      expect(mapped.images).toEqual(['https://example.com/img.jpg']);
      expect(mapped.specifications).toEqual({ processor: 'i5' });
      expect(mapped.availability).toBe('in_stock');
      expect(mapped.stock).toBeUndefined(); // no fake stock
      expect(mapped.source).toEqual({
        name: 'Czone',
        listingId: 'HP-VIC-15',
        url: 'https://example.com/hp-victus',
        type: 'scraper'
      });
      expect(mapped.seller).toEqual({
        name: 'Computer Zone Pakistan',
        type: 'retailer'
      });
    });

    test('only maps exact stock quantity when genuinely supplied', () => {
      // Case 1: Stock is present
      const mappedWithStock = mapProduct({
        productCode: 'CODE-1',
        title: 'Title',
        stock: 5,
        availability: 'In Stock'
      });
      expect(mappedWithStock.stock).toBe(5);

      // Case 2: Stock is absent
      const mappedWithoutStock = mapProduct({
        productCode: 'CODE-2',
        title: 'Title',
        availability: 'In Stock'
      });
      expect(mappedWithoutStock.stock).toBeUndefined();
    });

    test('fails safely if required fields like productCode are missing or empty', () => {
      expect(() => mapProduct({ title: 'No Code' })).toThrow('Czone productCode is required for mapping identity');
      expect(() => mapProduct({ productCode: ' ' })).toThrow('Czone productCode is required for mapping identity');
    });
  });

  describe('End-to-End Local Ingestion Flow', () => {
    test('runs end-to-end fixture -> parser -> mapper -> normalizeProduct -> upsertProduct', async () => {
      // 1. Load HTML fixture
      const html = readFixture('laptop.html');

      // 2. Parse HTML
      const parsed = parseProductHtml(html, 'https://example.com/hp-victus-link');

      // 3. Map parsed object
      const mapped = mapProduct(parsed);

      // 4. Normalize
      const normalized = normalizeProduct(mapped);

      // 5. Upsert into Memory DB
      const result = await upsertProduct(normalized);

      // Verify DB persistence details
      expect(result.operation).toBe('created');
      expect(result.product).toBeDefined();
      expect(result.product.name).toBe('HP Victus 15 Gaming Laptop');
      expect(result.product.price).toBe(195000);
      expect(result.product.brand).toBe('HP');
      expect(result.product.source.listingId).toBe('HP-VIC-15');
      expect(result.product.source.name).toBe('Czone');
      expect(result.product.source.url).toBe('https://example.com/hp-victus-link');
      expect(result.product.condition).toBe('new');
      expect(result.product.images).toEqual(['https://example.com/hp-victus.jpg']);
      expect(result.product.specifications).toEqual({ processor: 'Intel Core i5-12500H', ram: '8GB DDR4' });
      expect(result.product.availability).toBe('in_stock');
      expect(result.product.stock).toBeUndefined();
    });

    test('malformed fixture fails validation or mapping safely', async () => {
      const html = readFixture('malformed.html');
      const parsed = parseProductHtml(html);

      // Missing product code in malformed fixture should throw error on mapping
      expect(() => {
        mapProduct(parsed);
      }).toThrow('Czone productCode is required for mapping identity');
    });

    test('unknown category skips or fails safely in upsert', async () => {
      const rawCzoneUnknownCat = {
        productCode: 'UNKNOWN-CAT-1',
        title: 'Some Generic Item',
        categoryRaw: 'Home Appliances', // unknown category
        priceText: 'Rs. 2,500'
      };

      const mapped = mapProduct(rawCzoneUnknownCat);
      expect(mapped.category).toBeUndefined();

      const normalized = normalizeProduct(mapped);
      expect(normalized.category).toBeUndefined();

      // Upserting product with unresolved category should fail category check
      await expect(upsertProduct(normalized)).rejects.toThrow('Category cannot be resolved');
    });
  });
});
