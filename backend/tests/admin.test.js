const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Order = require('../src/models/Order');

const { connectTestDB, disconnectTestDB } = require('./setup/testDb');

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe('Admin Basics Integration Tests', () => {
  let adminUser, adminToken;
  let regularUser, regularToken;
  let category;

  beforeEach(async () => {
    // Clear databases
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    // Create Category
    category = await Category.create({ name: 'Laptops', slug: 'laptops' });

    // Create regular user
    const resUser = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Jane Doe',
        email: 'admin.user@example.com',
        password: 'securePassword123'
      });
    regularToken = resUser.body.data.token;
    regularUser = resUser.body.data.user;

    // Create admin user
    const resAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin Boss',
        email: 'admin.admin@example.com',
        password: 'securePassword123'
      });
    
    // Promote user to admin role directly in DB
    await User.updateOne({ email: 'admin.admin@example.com' }, { role: 'admin' });
    
    // Re-authenticate admin to obtain token with admin role
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin.admin@example.com',
        password: 'securePassword123'
      });
    adminToken = loginRes.body.data.token;
    adminUser = loginRes.body.data.user;
  });

  describe('Authorization checks (Regular user must be blocked)', () => {
    it('should return 403 when non-admin attempts to retrieve admin products', async () => {
      const res = await request(app)
        .get('/api/products/admin/all')
        .set('Authorization', `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when non-admin attempts to create a product', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ name: 'Test' });
      expect(res.status).toBe(403);
    });

    it('should return 403 when non-admin attempts to edit a product', async () => {
      const p = await Product.create({ name: 'A', slug: 'a', sku: 'A1', description: 'A', price: 10, stock: 1, category: category._id, brand: 'B' });
      const res = await request(app)
        .put(`/api/products/${p._id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ name: 'Edit' });
      expect(res.status).toBe(403);
    });

    it('should return 403 when non-admin attempts to create a category', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ name: 'Test', slug: 'test' });
      expect(res.status).toBe(403);
    });

    it('should return 403 when non-admin attempts to retrieve all orders', async () => {
      const res = await request(app)
        .get('/api/orders/admin/all')
        .set('Authorization', `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when non-admin attempts to update order status', async () => {
      const res = await request(app)
        .put('/api/orders/some-id/status')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ status: 'confirmed' });
      expect(res.status).toBe(403);
    });

    it('should return 403 when non-admin attempts to list users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Administrative operations (Admin must succeed)', () => {
    it('should retrieve all products (active and inactive) for admin', async () => {
      await Product.create({ name: 'A', slug: 'a', sku: 'A1', description: 'A', price: 10, stock: 1, category: category._id, brand: 'B', isActive: true });
      await Product.create({ name: 'B', slug: 'b', sku: 'B1', description: 'B', price: 20, stock: 2, category: category._id, brand: 'B', isActive: false });

      const res = await request(app)
        .get('/api/products/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('should allow admin to create product with validation and duplicate checking', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Super Laptop',
          slug: 'super-laptop',
          sku: 'SKU-SL1',
          description: 'A super laptop',
          price: 1500,
          stock: 10,
          category: category._id,
          brand: 'SuperBrand',
          image: 'http://image.png'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Super Laptop');
      expect(res.body.data.images[0]).toBe('http://image.png');

      // Test duplicate slug reject
      const resDup = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Another Laptop',
          slug: 'super-laptop',
          sku: 'SKU-SL2',
          description: 'Desc',
          price: 100,
          stock: 5,
          category: category._id,
          brand: 'Brand'
        });
      expect(resDup.status).toBe(400);
      expect(resDup.body.error.message).toContain('slug is already in use');
    });

    it('should allow admin to update product fields with allowlist validation', async () => {
      const p = await Product.create({ name: 'A', slug: 'a', sku: 'A1', description: 'A', price: 10, stock: 1, category: category._id, brand: 'B' });
      
      const res = await request(app)
        .put(`/api/products/${p._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated A',
          price: 50,
          stock: 5,
          isActive: false,
          role: 'hacked' // Unallowed field, must be ignored or not affect role
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated A');
      expect(res.body.data.price).toBe(50);
      expect(res.body.data.stock).toBe(5);
      expect(res.body.data.isActive).toBe(false);

      // Verify unallowed role field was ignored and Mongoose model not corrupted
      const updatedProduct = await Product.findById(p._id);
      expect(updatedProduct.role).toBeUndefined();
    });

    it('should allow admin to create a category with uniqueness checking', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Phones', slug: 'phones' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Phones');

      // Test duplicate
      const resDup = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Mobile Phones', slug: 'phones' });

      expect(resDup.status).toBe(400);
      expect(resDup.body.error.message).toContain('slug is already in use');
    });

    it('should retrieve all registered users showing only safe fields', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2); // Jane Doe & Admin Boss
      
      const jane = res.body.data.find(u => u.email === 'admin.user@example.com');
      expect(jane.name).toBe('Jane Doe');
      expect(jane.role).toBe('user');
      expect(jane.password).toBeUndefined(); // Password hash must be hidden!
      expect(jane.__v).toBeUndefined();
    });

    it('should list all platform orders and allow status transitions', async () => {
      const p = await Product.create({ name: 'A', slug: 'a', sku: 'A1', description: 'A', price: 10, stock: 1, category: category._id, brand: 'B' });
      const order = await Order.create({
        user: regularUser._id,
        items: [{ product: p._id, name: 'A', sku: 'A1', price: 10, quantity: 1 }],
        shippingAddress: { fullName: 'Jane', addressLine: '123 Tech', city: 'Silicon', postalCode: '1', country: 'US' },
        subtotal: 10,
        status: 'pending'
      });

      // Get all orders
      const resAll = await request(app)
        .get('/api/orders/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resAll.status).toBe(200);
      expect(resAll.body.data.length).toBe(1);
      expect(resAll.body.data[0].user.email).toBe('admin.user@example.com'); // Populated user details

      // Update status: pending -> confirmed (Allowed)
      const resUpdate1 = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' });

      expect(resUpdate1.status).toBe(200);
      expect(resUpdate1.body.data.status).toBe('confirmed');

      // Update status: confirmed -> delivered (Invalid: must go processing or shipped first)
      const resUpdateFail = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'delivered' });

      expect(resUpdateFail.status).toBe(400);
      expect(resUpdateFail.body.error.message).toContain('Cannot transition order status');
    });
  });
});
