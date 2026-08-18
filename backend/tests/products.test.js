const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');

require('dotenv').config();
let mongoServer;

jest.setTimeout(120000); // Allow download of MongoDB binary in tests

beforeAll(async () => {
  // Avoid logging during tests
  process.env.NODE_ENV = 'test';
  
  // Use MONGODB_URI from env if it exists, appending _test database name to isolate test data
  let uri = process.env.MONGODB_URI;
  if (uri) {
    if (uri.includes('?')) {
      const parts = uri.split('?');
      // Replace or append database name
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

let laptopCat, audioCat;
let testLaptop, budgetLaptop, testHeadphone;

beforeEach(async () => {
  // Clear database
  await Category.deleteMany({});
  await Product.deleteMany({});

  // Seed minimum datasets for tests
  laptopCat = await Category.create({
    name: 'Laptops',
    slug: 'laptops',
    description: 'Workstations'
  });

  audioCat = await Category.create({
    name: 'Audio',
    slug: 'audio',
    description: 'Sound equipment'
  });

  testLaptop = await Product.create({
    name: 'Pro Laptop 15',
    slug: 'pro-laptop-15',
    sku: 'PRO-L15',
    description: 'Excellent programming workstation for Docker and VM execution.',
    price: 200000,
    stock: 5,
    category: laptopCat._id,
    brand: 'SuperTech',
    rating: 4.8,
    isFeatured: true,
    isActive: true,
    specifications: {
      ramGB: 16,
      ports: ['USB-C', 'HDMI'],
      wireless: true
    }
  });

  budgetLaptop = await Product.create({
    name: 'LiteBook 13',
    slug: 'litebook-13',
    sku: 'LIT-B13',
    description: 'Budget office computer.',
    price: 80000,
    stock: 10,
    category: laptopCat._id,
    brand: 'SuperTech',
    rating: 4.2,
    isFeatured: false,
    isActive: true,
    specifications: {
      ramGB: 8,
      ports: ['USB-A'],
      wireless: true
    }
  });

  testHeadphone = await Product.create({
    name: 'Noise Block 5',
    slug: 'noise-block-5',
    sku: 'NS-B5',
    description: 'Active noise cancelation studio headphones.',
    price: 30000,
    stock: 3,
    category: audioCat._id,
    brand: 'AudioPhile',
    rating: 4.5,
    isFeatured: false,
    isActive: true,
    specifications: {
      wireless: true,
      hasANC: true
    }
  });
});

describe('Product API Integration Tests', () => {
  
  describe('GET /api/products', () => {
    
    test('should successfully retrieve all active products', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalItems).toBe(3);
    });

    test('should sort products by default (featured first, then newest)', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toBe(200);
      // 'Pro Laptop 15' is featured, should be first
      expect(res.body.data[0].name).toBe('Pro Laptop 15');
    });

    test('should correctly apply pagination parameters (page, limit)', async () => {
      const res = await request(app).get('/api/products?page=1&limit=2');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    test('should filter products by category slug', async () => {
      const res = await request(app).get('/api/products?category=audio');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].slug).toBe('noise-block-5');
    });

    test('should return empty array if category slug does not exist', async () => {
      const res = await request(app).get('/api/products?category=unknown-category');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(0);
      expect(res.body.pagination.totalItems).toBe(0);
    });

    test('should filter products by brand name (case-insensitive)', async () => {
      const res = await request(app).get('/api/products?brand=supertech');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    test('should perform case-insensitive text search on name, description, and brand', async () => {
      const res = await request(app).get('/api/products?search=docker');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Pro Laptop 15');
    });

    test('should filter products by price range (minPrice, maxPrice)', async () => {
      const res = await request(app).get('/api/products?minPrice=50000&maxPrice=150000');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].slug).toBe('litebook-13');
    });

    test('should handle validation errors for bad price input parameters', async () => {
      const res = await request(app).get('/api/products?minPrice=abc');
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid minPrice value');
    });
  });

  describe('GET /api/products/:slug', () => {
    test('should return correct single product details for a valid slug', async () => {
      const res = await request(app).get('/api/products/pro-laptop-15');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe('PRO-L15');
      expect(res.body.data.category.name).toBe('Laptops');
    });

    test('should return 404 for unknown product slug', async () => {
      const res = await request(app).get('/api/products/non-existent-product-slug');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Product not found');
    });
  });

  describe('GET /api/categories', () => {
    test('should retrieve active category filters', async () => {
      const res = await request(app).get('/api/categories');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].name).toBe('Audio'); // sorted alphabetically: Audio, Laptops
    });
  });
});
