/**
 * backend/__tests__/auth.test.js
 * Tests for auth routes
 */
const request = require('supertest');
const { app } = require('../server');

describe('Auth Routes', () => {
  describe('POST /auth/register', () => {
    it('should return 400 if email missing', async () => {
      const res = await request(app).post('/auth/register').send({ password: 'test1234' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 if password missing', async () => {
      const res = await request(app).post('/auth/register').send({ email: 'test@test.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    it('should return 400 if body empty', async () => {
      const res = await request(app).post('/auth/login').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app).get('/auth/me').set('Authorization', 'Bearer invalid_token');
      expect(res.status).toBe(401);
    });
  });
});
