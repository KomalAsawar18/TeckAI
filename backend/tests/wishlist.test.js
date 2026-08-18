const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Wishlist = require('../src/models/Wishlist');

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
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('Wishlist Integration Tests', () => {
  let user, token, activeProduct, inactiveProduct;

  beforeEach(async () => {
    // Clear databases
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Wishlist.deleteMany({});

    // Create test user and login to get token
    user = await User.create({
      name: 'Jane Doe',
      email: 'wishlist.user@example.com',
      password: 'securePassword123'
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'wishlist.user@example.com',
        password: 'securePassword123'
      });
    token = loginRes.body.data.token;

    // Create test category
    const cat = await Category.create({ name: 'Gadgets', slug: 'gadgets' });

    // Seed test products
    activeProduct = await Product.create({
      name: 'Smart Watch',
      slug: 'smart-watch',
      sku: 'WATCH-1',
      description: 'Activity tracker',
      price: 15000,
      stock: 10,
      category: cat._id,
      brand: 'TimeTech',
      isActive: true
    });

    inactiveProduct = await Product.create({
      name: 'Legacy Watch',
      slug: 'legacy-watch',
      sku: 'WATCH-OLD',
      description: 'Discontinued tracker',
      price: 8000,
      stock: 2,
      category: cat._id,
      brand: 'TimeTech',
      isActive: false
    });
  });

  describe('GET /api/wishlist', () => {
    it('should block anonymous requests', async () => {
      const res = await request(app).get('/api/wishlist');
      expect(res.statusCode).toBe(401);
    });

    it('should return empty products list for new user', async () => {
      const res = await request(app)
        .get('/api/wishlist')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toEqual([]);
    });

    it('should retrieve populated wishlist products successfully', async () => {
      // Seed wishlist directly in DB
      await Wishlist.create({
        user: user._id,
        products: [activeProduct._id]
      });

      const res = await request(app)
        .get('/api/wishlist')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products.length).toBe(1);
      expect(res.body.data.products[0].name).toBe('Smart Watch');
    });
  });

  describe('POST /api/wishlist', () => {
    it('should block anonymous requests', async () => {
      const res = await request(app).post('/api/wishlist').send({ productId: activeProduct._id });
      expect(res.statusCode).toBe(401);
    });

    it('should add product successfully without duplicates on double calls', async () => {
      // First call
      let res = await request(app)
        .post('/api/wishlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: activeProduct._id.toString() });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products.length).toBe(1);

      // Second call (should prevent duplicate via $addToSet)
      res = await request(app)
        .post('/api/wishlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: activeProduct._id.toString() });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.products.length).toBe(1); // Still 1
    });

    it('should reject adding non-existent product IDs', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/wishlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: fakeId });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Product not found');
    });

    it('should reject adding inactive products', async () => {
      const res = await request(app)
        .post('/api/wishlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: inactiveProduct._id.toString() });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('no longer active');
    });
  });

  describe('DELETE /api/wishlist/:productId', () => {
    it('should block anonymous requests', async () => {
      const res = await request(app).delete(`/api/wishlist/${activeProduct._id}`);
      expect(res.statusCode).toBe(401);
    });

    it('should successfully remove product from user wishlist', async () => {
      // Seed wishlist directly in DB
      await Wishlist.create({
        user: user._id,
        products: [activeProduct._id]
      });

      const res = await request(app)
        .delete(`/api/wishlist/${activeProduct._id.toString()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toEqual([]); // Now empty
    });
  });
});
