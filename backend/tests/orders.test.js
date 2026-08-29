const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');

const { connectTestDB, disconnectTestDB } = require('./setup/testDb');

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe('Orders & Checkout Integration Tests', () => {
  let user1, token1;
  let user2, token2;
  let activeProduct1, activeProduct2, inactiveProduct;
  let category;

  beforeEach(async () => {
    // Clear databases
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});

    // Create Category
    category = await Category.create({ name: 'Laptops', slug: 'laptops' });

    // Create Products
    activeProduct1 = await Product.create({
      name: 'Ultrabook X',
      slug: 'ultrabook-x',
      description: 'Thin laptop',
      price: 120000,
      category: category._id,
      brand: 'BrandA',
      stock: 10,
      sku: 'SKU-UX10',
      isActive: true
    });

    activeProduct2 = await Product.create({
      name: 'Developer Laptop Pro',
      slug: 'dev-laptop-pro',
      description: 'Pro specs laptop',
      price: 250000,
      category: category._id,
      brand: 'BrandA',
      stock: 5,
      sku: 'SKU-DLP5',
      isActive: true
    });

    inactiveProduct = await Product.create({
      name: 'Old Keyboard',
      slug: 'old-keyboard',
      description: 'Inactive mechanical keyboard',
      price: 5000,
      category: category._id,
      brand: 'BrandB',
      stock: 5,
      sku: 'SKU-OK5',
      isActive: false
    });

    // Create User 1 & Login
    const registerRes1 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Jane Doe',
        email: 'orders.user@example.com',
        password: 'securePassword123'
      });
    token1 = registerRes1.body.data.token;
    user1 = registerRes1.body.data.user;

    // Create User 2 & Login (Attacker)
    const registerRes2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Attacker John',
        email: 'orders.attacker@example.com',
        password: 'securePassword123'
      });
    token2 = registerRes2.body.data.token;
    user2 = registerRes2.body.data.user;
  });

  const validShippingAddress = {
    fullName: 'Jane Doe',
    addressLine: '123 Tech Lane',
    city: 'Silicon City',
    postalCode: '94043',
    country: 'USA'
  };

  describe('POST /api/orders', () => {
    it('should reject unauthenticated checkout requests', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ shippingAddress: validShippingAddress });
      expect(res.status).toBe(401);
    });

    it('should fail checkout if the cart is empty or missing', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token1}`)
        .send({ shippingAddress: validShippingAddress });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Your cart is empty');
    });

    it('should fail checkout if shipping address parameters are missing or invalid', async () => {
      // Seed cart
      await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${token1}`)
        .send({ items: [{ product: activeProduct1._id, quantity: 2 }] });

      const badAddress = { fullName: 'Jane Doe' }; // Missing other fields

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token1}`)
        .send({ shippingAddress: badAddress });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('field "addressLine" is required');
    });

    it('should fail checkout if ordering quantities above current stock', async () => {
      // Seed cart directly in the DB to bypass cart PUT validation
      await Cart.create({
        user: user1._id,
        items: [{ product: activeProduct1._id, quantity: 15 }]
      });

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token1}`)
        .send({ shippingAddress: validShippingAddress });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Insufficient stock');
    });

    it('should fail checkout if product is inactive', async () => {
      // Manually bypass cart schema validators (or populate it directly)
      await Cart.create({
        user: user1._id,
        items: [{ product: inactiveProduct._id, quantity: 1 }]
      });

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token1}`)
        .send({ shippingAddress: validShippingAddress });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('is currently unavailable');
    });

    it('should place order successfully, check subtotal, snapshot items, decrease stock, and empty cart', async () => {
      // 1. Add items to user's cart
      await request(app)
        .put('/api/cart')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          items: [
            { product: activeProduct1._id, quantity: 2 }, // 2 * 120,000 = 240,000
            { product: activeProduct2._id, quantity: 1 }  // 1 * 250,000 = 250,000
          ]
        });

      // 2. Perform checkout POST
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token1}`)
        .send({ shippingAddress: validShippingAddress });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      
      const order = res.body.data;
      expect(order.subtotal).toBe(490000); // 240,000 + 250,000
      expect(order.paymentMethod).toBe('Cash on Delivery');
      expect(order.items.length).toBe(2);

      // Verify immutable item snapshot
      const itemSnapshot = order.items.find(i => i.product.toString() === activeProduct1._id.toString());
      expect(itemSnapshot.name).toBe('Ultrabook X');
      expect(itemSnapshot.sku).toBe('SKU-UX10');
      expect(itemSnapshot.price).toBe(120000);

      // Verify stock decreased atomically
      const updatedProd1 = await Product.findById(activeProduct1._id);
      expect(updatedProd1.stock).toBe(8); // 10 - 2

      const updatedProd2 = await Product.findById(activeProduct2._id);
      expect(updatedProd2.stock).toBe(4); // 5 - 1

      // Verify user's cart is deleted
      const finalCart = await Cart.findOne({ user: user1._id });
      expect(finalCart).toBeNull();
    });

    it('should rollback stock changes completely if order processing fails mid-checkout', async () => {
      // Seed cart with activeProduct1 (stock 10) and activeProduct2 (stock 5)
      // But we will manually alter activeProduct2 inside cart to require 10 items (insufficient)
      await Cart.create({
        user: user1._id,
        items: [
          { product: activeProduct1._id, quantity: 2 }, // Valid (takes stock to 8)
          { product: activeProduct2._id, quantity: 10 } // Insufficient (triggers failure)
        ]
      });

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token1}`)
        .send({ shippingAddress: validShippingAddress });

      expect(res.status).toBe(400);

      // Check database to verify activeProduct1 stock was NOT decremented (rolled back)
      const testProd1 = await Product.findById(activeProduct1._id);
      expect(testProd1.stock).toBe(10); // Remains 10

      const testProd2 = await Product.findById(activeProduct2._id);
      expect(testProd2.stock).toBe(5); // Remains 5

      // Verify cart still exists
      const testCart = await Cart.findOne({ user: user1._id });
      expect(testCart).not.toBeNull();
      expect(testCart.items.length).toBe(2);
    });
  });

  describe('GET /api/orders', () => {
    it('should restrict order history access to authenticated sessions', async () => {
      const res = await request(app).get('/api/orders');
      expect(res.status).toBe(401);
    });

    it('should fetch user orders history successfully', async () => {
      // Create a dummy order manually
      await Order.create({
        user: user1._id,
        items: [{ product: activeProduct1._id, name: 'Prod A', sku: 'SKUA', price: 1000, quantity: 1 }],
        shippingAddress: validShippingAddress,
        subtotal: 1000
      });

      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should protect single order details views and enforce owner checks', async () => {
      // Create user 1 order
      const order = await Order.create({
        user: user1._id,
        items: [{ product: activeProduct1._id, name: 'Prod A', sku: 'SKUA', price: 1000, quantity: 1 }],
        shippingAddress: validShippingAddress,
        subtotal: 1000
      });

      // User 2 tries to fetch User 1's order
      const res = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('not authorized to view this order');

      // User 1 fetches their own order
      const resOk = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(resOk.status).toBe(200);
      expect(resOk.body.data._id.toString()).toBe(order._id.toString());
    });
  });
});
