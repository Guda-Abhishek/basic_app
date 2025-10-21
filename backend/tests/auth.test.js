const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

beforeAll(async () => {
  // Use existing test database connection
}, 30000);

afterAll(async () => {
  // Don't disconnect as the server manages the connection
}, 30000);

beforeEach(async () => {
  await User.deleteMany({});
  // Set environment variables for testing
  process.env.SKIP_EMAIL_VERIFICATION = 'true';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';
});

describe('Authentication Endpoints', () => {
  const testUser = {
    fullName: 'Test User',
    email: 'test@example.com',
    phoneNumber: '6123456789',
    password: 'TestPass123!',
    confirmPassword: 'TestPass123!'
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Accept', 'application/json')
        .send(testUser)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.fullName).toBe(testUser.fullName);
    });

    it('should not register user with existing email', async () => {
      await User.create(testUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await User.create(testUser);
    });

    it('should login successfully with email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({
          emailOrPhone: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should login successfully with phone number', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({
          emailOrPhone: testUser.phoneNumber,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrPhone: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let refreshToken;

    beforeEach(async () => {
      const user = await User.create(testUser);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({
          emailOrPhone: testUser.email,
          password: testUser.password
        });

      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalidtoken' })
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toBe('Invalid or expired refresh token');
    });
  });
});
