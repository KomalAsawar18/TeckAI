const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

const { connectTestDB, disconnectTestDB } = require('./setup/testDb');

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe('User Authentication Integration Tests', () => {
  const testUserEmail = 'john.doe@example.com';
  const testUserPassword = 'secretPassword123';

  beforeEach(async () => {
    // Clear users database
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should successfully register a new user with hashed credentials and token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: testUserEmail,
          password: testUserPassword
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(testUserEmail);
      expect(res.body.data.user.password).toBeUndefined(); // Verify password stripped

      // Confirm user document created with hashed password
      const user = await User.findOne({ email: testUserEmail });
      expect(user).toBeDefined();
      expect(user.password).not.toBe(testUserPassword); // Confirm hashed
    });

    it('should fail registration if email is already taken', async () => {
      // Seed user
      await User.create({
        name: 'Existing User',
        email: testUserEmail,
        password: testUserPassword
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: testUserEmail,
          password: 'anotherPassword'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('already registered');
    });

    it('should reject registration if password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: testUserEmail,
          password: '123'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('at least 6 characters');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create user
      await User.create({
        name: 'John Doe',
        email: testUserEmail,
        password: testUserPassword
      });
    });

    it('should successfully authenticate user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.name).toBe('John Doe');
    });

    it('should reject login for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@example.com',
          password: testUserPassword
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid email or password');
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: 'incorrectPassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject profile access if no token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('No authentication token provided');
    });

    it('should reject profile access with an invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken123');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid or expired authentication token');
    });

    it('should retrieve user profile successfully with a valid token', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: testUserEmail,
        password: testUserPassword
      });

      // Login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword
        });

      const token = loginRes.body.data.token;

      // Access profile
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('John Doe');
      expect(res.body.data.email).toBe(testUserEmail);
      expect(res.body.data.password).toBeUndefined(); // Confirm password stripped
    });
  });
});
