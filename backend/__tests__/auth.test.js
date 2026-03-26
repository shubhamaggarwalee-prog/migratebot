/**
 * backend/__tests__/auth.test.js
 */
const request = require('supertest');
const { app } = require('../server');

describe('Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    it('returns 400 if email missing', async () => {
      const res = await request(app).post('/api/auth/register').send({ password: 'test1234' });
      expect(res.status).toBe(400);
    });

    it('returns 400 if password missing', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'test@test.com' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 400 if body empty', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');
      expect(res.status).toBe(401);
    });
  });
});
