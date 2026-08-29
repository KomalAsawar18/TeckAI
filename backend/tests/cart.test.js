const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Cart = require('../src/models/Cart');

const { connectTestDB, disconnectTestDB } = require('./setup/testDb');

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe('Shopping Cart Integration Tests', () => {
  let user, token, activeProduct, outOfStockProduct, inactiveProduct;

  beforeEach(async () => {
    // Clear databases
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});

    // Create test user and login to get token
    user = await User.create({
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      password: 'securePassword123'
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'jane.doe@example.com',
        password: 'securePassword123'
      });
    token = loginRes.body.data.token;

    // Create test category
    const cat = await Category.create({ name: 'Accessories', slug: 'accessories' });

    // Seed test products
    activeProduct = await Product.create({
      name: 'USB-C Cable',
      slug: 'usb-c-cable',
      sku: 'USBC-123',
      description: 'High-speed cable',
      price: 1500,
      stock: 10,
      category: cat._id,
      brand: 'CableMax',
      isActive: true
    });

    outOfStockProduct = await Product.create({
      name: 'Sold Out Hub',
      slug: 'sold-out-hub',
      sku: 'HUB-SOLD',
      description: 'Multiport adapter',
      price: 5000,
      stock: 0,
      category: cat._id,
      brand: 'PortPlus',
      isActive: true
    });

    inactiveProduct = await Product.create({
      name: 'Discontinued Laptop',
      slug: 'discontinued-laptop',
      sku: 'LAP-DISC',
      description: 'Legacy hardware',
      price: 180000,
      stock: 5,
      category: cat._id,
      brand: 'OldTech',
      isActive: false
    });
  });

  describe('GET /api/cart', () => {
    it('should block anonymous requests', async () => {
      const res = await request(app).get('/api/cart');
      expect(res.statusCode).toBe(401);
    });

    it('should return empty cart defaults for a new user', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('should retrieve populated cart items successfully', async () => {
      // Seed cart directly in DB
      await Cart.create({
        user: user._id,
        items: [{ product: activeProduct._id, quantity: 2 }]
      });

      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].product.name).toBe('USB-C Cable');
      expect(res.body.data.items[0].quantity).toBe(2);
    });
  });

  describe('PUT /api/cart', () => {
    it('should block anonymous requests', async () => {
      const res = await request(app).put('/api/cart').send({ items: [] });
      expect(res.statusCode).toBe(401);
    });

    it('should successfully update / replace entire cart items list', async () => {
      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { product: activeProduct._id.toString(), quantity: 3 }
          ]
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].product._id.toString()).toBe(activeProduct._id.toString());
      expect(res.body.data.items[0].quantity).toBe(3);
    });

    it('should reject invalid product ID structures', async () => {
      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { product: 'not-an-objectid', quantity: 1 }
          ]
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid product ID');
    });

    it('should reject zero or negative quantities', async () => {
      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { product: activeProduct._id.toString(), quantity: 0 }
          ]
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('greater than zero');
    });

    it('should reject quantities exceeding warehouse stock limits', async () => {
      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { product: activeProduct._id.toString(), quantity: 15 } // 15 exceeds 10 stock
          ]
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('exceeds available stock');
    });

    it('should reject discontinued or inactive products', async () => {
      const res = await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { product: inactiveProduct._id.toString(), quantity: 1 }
          ]
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('no longer active');
    });
  });
});
