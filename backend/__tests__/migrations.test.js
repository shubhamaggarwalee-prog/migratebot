/**
 * backend/__tests__/migrations.test.js
 */
const request = require('supertest');
const { app } = require('../server');

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Migrations Routes — auth guards', () => {
  describe('GET /api/migrations', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/migrations');
      expect(res.status).toBe(401);
    });
    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/migrations')
        .set('Authorization', FAKE_TOKEN);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/migrations/:id', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/migrations/some-id');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/migrations', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app)
        .post('/api/migrations')
        .send({ repourl: 'https://github.com/user/repo' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/migrations/:id/analyze', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).post('/api/migrations/abc/analyze');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/migrations/:id/start', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).post('/api/migrations/abc/start');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/migrations/:id', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).delete('/api/migrations/abc');
      expect(res.status).toBe(401);
    });
  });
});
