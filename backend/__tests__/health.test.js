/**
 * backend/__tests__/health.test.js
 */
const request = require('supertest');
const { app } = require('../server');

describe('Health Routes', () => {
  it('GET /api/health returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
